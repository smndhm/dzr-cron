// Import DZR utils
import {
  getFavouriteArtists,
  getBatch,
  getPlaylist,
  getPlaylistTracks,
  getListeningHistory,
  postPlaylistTracks,
  deletePlaylistTracks,
  postPlaylistDescription,
} from '../utils/dzr';
// Import the mark left in the playlist description
import { asDate, readWatermark, writeWatermark } from '../utils/watermark';
// Import the ids earlier runs poured in
import { hasState, readPoured, prunePoured, writePoured } from '../utils/state';
// Import logger
import setLogger from '../utils/logger';
// Import run summary
import { reportChange } from '../utils/summary';
const logger = setLogger('new-releases');
// Import types
import { Playlist, DeezerTrack, DeezerAlbum, DeezerArtist } from '../types';
import { Poured } from '../utils/state';

// Deezer answers at most fifty calls in one batch
const BATCH_SIZE = 50;

const DAY = 24 * 60 * 60 * 1000;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// Every entry of a batch answers for itself, so one artist Deezer refuses does
// not lose the forty nine others. Entries keep the order they were sent in.
const batchEntries = <T>(
  batchResult: { data?: T[], error?: unknown }[],
  onError: () => void,
): T[][] =>
    batchResult.map((entry) => {
      if (entry.error) {
        logger.error('API Error Response', entry.error);
        onError();
        return [];
      }
      return entry.data ?? [];
    });

const batchData = <T>(
  batchResult: { data?: T[], error?: unknown }[],
  onError: () => void,
): T[] => batchEntries<T>(batchResult, onError).flat();

// Writes down the day this run covered, so the next one starts after it
const leaveMark = async (
  access_token: string,
  playlistId: number,
  description: unknown,
  day: string,
  complete: boolean,
) => {
  if (!complete) {
    logger.warn('Incomplete run, leaving the mark where it was');
    return;
  }
  // Deezer answers "" for a playlist without a description, so anything else is
  // an answer to leave alone: writing would wipe whatever the owner wrote.
  if (typeof description !== 'string') {
    logger.warn('No description to read, leaving it alone', { playlist: playlistId });
    return;
  }
  const next = writeWatermark(description, day);
  if (next === description) {
    return;
  }
  // Deezer answers 200 with an error payload, so a refused write looks like a
  // successful one, and this one losing the day covered has to be said.
  const answer = await postPlaylistDescription(access_token, playlistId, next);
  if (answer?.error) {
    logger.error('API Error Response', answer.error);
    return;
  }
  logger.info('Mark written', { playlist: playlistId, day });
};

// Script
export default async function newReleases({
  playlistId,
  access_token,
  days = 15,
  recordTypes,
}: Playlist & {days?: number} & {recordTypes?: string[]}) {
  try {
    logger.info('Script started');

    // A run that missed an artist must not claim its day as covered
    let complete = true;
    const incomplete = () => {
      complete = false;
    };

    // WHERE THE PREVIOUS RUN STOPPED
    const playlist = await getPlaylist(access_token, playlistId);
    if (playlist.error) {
      logger.error('API Error Response', playlist.error);
      return;
    }
    const watermark = readWatermark(playlist.description);
    // From the mark when there is one, so a release is looked at once and never
    // again. Dates compare as strings in this format.
    const today = asDate(Date.now());
    // The furthest back any run can look. It is also how long an id is worth
    // remembering: the whole window rather than the two days a mark leaves,
    // since a mark that could not be written sends the next run back here.
    const keepSince = asDate(Date.now() - days * DAY);
    const since = watermark ?? keepSince;

    // WHAT IS IN THE PLAYLIST, AND WHAT HAS BEEN LISTENED TO
    // The same two answers decide what to pour in and what to take out
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId,
    );
    const playlistTracksId = new Set<number>(
      dzrDestinationPlaylistTracks.map((track: DeezerTrack) => track.id),
    );

    // WHAT EARLIER RUNS POURED IN
    // The playlist forgets a track the moment anything takes it out, whether a
    // play or the owner, and the history forgets the play within hours. Without
    // this, the track reads as new and comes straight back.
    let poured: Poured = {};
    const remembering = hasState();
    if (remembering) {
      try {
        poured = readPoured();
      } catch (e) {
        logger.error(e);
      }
    } else {
      logger.warn('No state directory, a track already poured in may come back');
    }

    const history = await getListeningHistory(access_token);
    if (history.error) {
      logger.error('API Error Response', history.error);
      incomplete();
    }
    const playedTracksId = new Set<number>(
      (history.data ?? []).map((track: DeezerTrack) => track.id),
    );
    // Deezer does not say how deep the history goes, and it decides how long
    // this cron may sleep, so the runs measure it
    logger.info('Listening history', { tracks: playedTracksId.size });

    // TAKE OUT WHAT HAS BEEN HEARD
    // Before the discovery, so a run that finds no release still cleans up
    const tracksToRemove = Array.from(playlistTracksId).filter((track) =>
      playedTracksId.has(track),
    );
    if (tracksToRemove.length) {
      await deletePlaylistTracks(access_token, playlistId, tracksToRemove);
      tracksToRemove.forEach((track) => playlistTracksId.delete(track));
      reportChange(logger, {
        action: 'tracks-removed',
        playlist: playlistId,
        tracks: tracksToRemove,
      });
    }

    // GET FAVOURITE ARTISTS
    const artists = await getFavouriteArtists(access_token);
    if (artists.error) {
      logger.error('API Error Response', artists.error);
      return;
    }

    const artistIds: number[] = artists.data.map((artist: DeezerArtist) => artist.id);
    if (artistIds.length === 0) {
      logger.info('No favourite artist');
      return;
    }

    // GET THEIR ALBUMS, FIFTY ARTISTS AT A TIME
    const albums: DeezerAlbum[] = [];
    for (const group of chunk(artistIds, BATCH_SIZE)) {
      const { batch_result } = await getBatch(
        access_token,
        group.map((artistId) => `artist/${artistId}/albums`),
      );
      albums.push(...batchData<DeezerAlbum>(batch_result, incomplete));
    }

    // KEEP THE RECENT ONES
    // Album id to its release date. A map because an album two artists released
    // together answers in both their lists, and because the date is what a
    // poured track is remembered by.
    const releases = new Map<number, string>();
    albums
      .filter(
        (album) =>
          album.release_date >= since &&
          (!recordTypes || recordTypes.includes(album.record_type)),
      )
      .forEach((album) => releases.set(album.id, album.release_date));

    if (releases.size === 0) {
      logger.info('No release since', { since });
      await leaveMark(access_token, playlistId, playlist.description, today, complete);
      return;
    }

    // GET THEIR TRACKS
    // An album not out yet is one Deezer published early, so only what it says
    // plays is taken and the rest waits for the day, when the album is still in
    // the window. Nowhere else: on an album already out the mark moves past it,
    // and a track wrongly held back would be lost rather than late.
    // Each released track, with the date of the album it came from
    const releasedTracks = new Map<number, string>();
    for (const group of chunk(Array.from(releases.keys()), BATCH_SIZE)) {
      const { batch_result } = await getBatch(
        access_token,
        group.map((albumId) => `album/${albumId}/tracks`),
      );
      batchEntries<DeezerTrack>(batch_result, incomplete).forEach((tracks, index) => {
        const releaseDate = releases.get(group[index]) ?? today;
        const notOutYet = releaseDate > today;
        tracks
          .filter((track) => !notOutYet || track.readable)
          .forEach((track) => releasedTracks.set(track.id, releaseDate));
      });
    }

    // ADD WHAT WAS NEVER POURED IN
    // A played release is never poured in, rather than taken out next run. One
    // already poured in is never poured again, however it left the playlist.
    const tracksToAdd = Array.from(releasedTracks.keys()).filter(
      (track) =>
        !playlistTracksId.has(track) &&
        !playedTracksId.has(track) &&
        poured[track] === undefined,
    );

    if (tracksToAdd.length) {
      await postPlaylistTracks(access_token, playlistId, tracksToAdd);
      reportChange(logger, {
        action: 'tracks-added',
        playlist: playlistId,
        tracks: tracksToAdd,
      });
      // Written down at once: what this run forgets to say it poured in, the
      // next one pours in again the moment the owner takes it out.
      if (remembering) {
        tracksToAdd.forEach((track) => {
          poured[track] = releasedTracks.get(track) ?? today;
        });
        try {
          writePoured(prunePoured(poured, keepSince));
        } catch (e) {
          logger.error(e);
        }
      }
    }

    await leaveMark(access_token, playlistId, playlist.description, today, complete);

    logger.info('Script ended');
  } catch (e) {
    logger.error(e);
  }
}
