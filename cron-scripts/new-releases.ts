// Import DZR utils
import {
  getFavouriteArtists,
  getBatch,
  getPlaylist,
  getPlaylistTracks,
  postPlaylistTracks,
  postPlaylistDescription,
} from '../utils/dzr';
// Import the note a run leaves for the next one
import { asDate, readWatermark, writeWatermark } from '../utils/watermark';
// Import logger
import setLogger from '../utils/logger';
// Import run summary
import { reportChange } from '../utils/summary';
const logger = setLogger('new-releases');
// Import types
import { Playlist, DeezerTrack, DeezerAlbum, DeezerArtist } from '../types';

// Deezer answers at most fifty calls in one batch
const BATCH_SIZE = 50;

// A whole album at a time adds up, and both the batch query string and the
// songs parameter of an add travel in the url. Split rather than find out
// where Deezer stops reading.
const ADD_SIZE = 100;

const DAY = 24 * 60 * 60 * 1000;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// Every entry of a batch answers for itself, so one artist Deezer refuses does
// not lose the forty nine others.
const batchData = <T>(
  batchResult: { data?: T[], error?: unknown }[],
  onError: () => void,
): T[] =>
    batchResult.flatMap((entry) => {
      if (entry.error) {
        logger.error('API Error Response', entry.error);
        onError();
        return [];
      }
      return entry.data ?? [];
    });

// Writes down the day this run covered, so the next one starts after it. A run
// that could not read every artist leaves the previous mark alone rather than
// claiming ground it never walked.
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
  // An absent description is not an empty one: Deezer answers "" for a playlist
  // without a description, so undefined means this answer is not the shape the
  // script expects. Writing then would replace whatever the owner wrote with a
  // bare mark, which is the one thing here that cannot be undone from a log.
  if (typeof description !== 'string') {
    logger.warn('No description to read, leaving it alone', { playlist: playlistId });
    return;
  }
  const next = writeWatermark(description, day);
  if (next === description) {
    return;
  }
  // Deezer answers 200 with an error payload of its own, so a write that did
  // not happen looks exactly like one that did. The mark is what keeps a track
  // from being poured back in, so a run that failed to leave it has to say so
  // rather than pass for green and lose the ground it covered.
  const answer = await postPlaylistDescription(access_token, playlistId, next);
  if (answer?.error) {
    logger.error('API Error Response', answer.error);
    return;
  }
  // Not a reportChange: the summary is about what changed in the playlist, and
  // the mark is bookkeeping rather than a track the owner would look for.
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

    // An artist Deezer refuses is an artist whose releases this run has not
    // seen, so the day it covers must not move past them.
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
    // The mark left by the previous run when there is one, so a release is
    // looked at once and never again, however long ago it was taken out of the
    // playlist. Dates compare as strings in this format.
    const today = asDate(Date.now());
    const since = watermark ?? asDate(Date.now() - days * DAY);
    // An album two artists released together answers in both their lists
    const albumIds = new Set(
      albums
        .filter(
          (album) =>
            album.release_date >= since &&
            (!recordTypes || recordTypes.includes(album.record_type)),
        )
        .map((album) => album.id),
    );

    if (albumIds.size === 0) {
      logger.info('No release since', { since });
      await leaveMark(access_token, playlistId, playlist.description, today, complete);
      return;
    }

    // GET THEIR TRACKS
    const releasedTracksId: number[] = [];
    for (const group of chunk(Array.from(albumIds), BATCH_SIZE)) {
      const { batch_result } = await getBatch(
        access_token,
        group.map((albumId) => `album/${albumId}/tracks`),
      );
      releasedTracksId.push(
        ...batchData<DeezerTrack>(batch_result, incomplete).map((track) => track.id),
      );
    }

    // GET DESTINATION PLAYLIST TRACKS
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId,
    );
    const playlistTracksId = new Set(
      dzrDestinationPlaylistTracks.map((track: DeezerTrack) => track.id),
    );

    // ADD WHAT IS NOT THERE YET
    // Nothing is ever removed here: a release stays until it has been heard,
    // which is what the listening history will answer for once the token can
    // read it. Until then the playlist only grows.
    const seen = new Set<number>();
    const tracksToAdd = releasedTracksId.filter((track) => {
      if (playlistTracksId.has(track) || seen.has(track)) {
        return false;
      }
      seen.add(track);
      return true;
    });

    if (tracksToAdd.length) {
      for (const group of chunk(tracksToAdd, ADD_SIZE)) {
        await postPlaylistTracks(access_token, playlistId, group);
      }
      reportChange(logger, {
        action: 'tracks-added',
        playlist: playlistId,
        tracks: tracksToAdd,
      });
    }

    await leaveMark(access_token, playlistId, playlist.description, today, complete);

    logger.info('Script ended');
  } catch (e) {
    logger.error(e);
  }
}
