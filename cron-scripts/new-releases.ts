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

const DAY = 24 * 60 * 60 * 1000;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// Every entry of a batch answers for itself, so one artist Deezer refuses does
// not lose the forty nine others. Entries come back in the order they were
// sent, which is what lets a caller tell which album an entry answers for.
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

    // WHAT IS IN THE PLAYLIST, AND WHAT HAS BEEN LISTENED TO
    // Both answers are needed to decide what to pour in, and they are the same
    // two the removal needs, so this cron takes played tracks out as well.
    // Failing to read the history is not fatal, but the day covered must not
    // move: a release already played would be poured in by the next run.
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId,
    );
    const playlistTracksId = new Set<number>(
      dzrDestinationPlaylistTracks.map((track: DeezerTrack) => track.id),
    );

    const history = await getListeningHistory(access_token);
    if (history.error) {
      logger.error('API Error Response', history.error);
      incomplete();
    }
    const playedTracksId = new Set<number>(
      (history.data ?? []).map((track: DeezerTrack) => track.id),
    );
    // How deep the history goes decides how long this cron may sleep between
    // runs: listen to more tracks than it holds and the earliest fall out
    // unseen, leaving those releases in the playlist for good. Deezer does not
    // say where it stops, so the runs say it instead.
    logger.info('Listening history', { tracks: playedTracksId.size });

    // TAKE OUT WHAT HAS BEEN HEARD
    // Before anything is discovered, so a run that finds no new release still
    // does what its name promises to the tracks already there.
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
    // The mark left by the previous run when there is one, so a release is
    // looked at once and never again, however long ago it was taken out of the
    // playlist. Dates compare as strings in this format.
    const today = asDate(Date.now());
    const since = watermark ?? asDate(Date.now() - days * DAY);
    // Each album to look into, and whether Deezer dates it after today. An
    // album two artists released together answers in both their lists, so a
    // map also keeps it from being asked for twice.
    const releases = new Map<number, boolean>();
    albums
      .filter(
        (album) =>
          album.release_date >= since &&
          (!recordTypes || recordTypes.includes(album.record_type)),
      )
      .forEach((album) => releases.set(album.id, album.release_date > today));

    if (releases.size === 0) {
      logger.info('No release since', { since });
      await leaveMark(access_token, playlistId, playlist.description, today, complete);
      return;
    }

    // GET THEIR TRACKS
    // An album dated after today is one Deezer has published early: the single
    // off it plays now, the rest of the record only on the day. So its tracks
    // are taken on what Deezer says can be played, and the others are left for
    // a later run. That filter is only trusted here, where being wrong repairs
    // itself: the album is still inside the window on its release day, since
    // the mark can never move past a date that has not come, so a track wrongly
    // held back is looked at again and poured in then. On an album already out,
    // the same filter would be final, and a track Deezer calls unplayable today
    // would be lost for good rather than merely late.
    const releasedTracksId: number[] = [];
    for (const group of chunk(Array.from(releases.keys()), BATCH_SIZE)) {
      const { batch_result } = await getBatch(
        access_token,
        group.map((albumId) => `album/${albumId}/tracks`),
      );
      batchEntries<DeezerTrack>(batch_result, incomplete).forEach((tracks, index) => {
        const notOutYet = releases.get(group[index]);
        releasedTracksId.push(
          ...tracks
            .filter((track) => !notOutYet || track.readable)
            .map((track) => track.id),
        );
      });
    }

    // ADD WHAT IS NOT THERE YET
    // A release already played is never poured in, rather than added now and
    // taken out on the next run.
    const seen = new Set<number>();
    const tracksToAdd = releasedTracksId.filter((track) => {
      if (playlistTracksId.has(track) || playedTracksId.has(track) || seen.has(track)) {
        return false;
      }
      seen.add(track);
      return true;
    });

    if (tracksToAdd.length) {
      await postPlaylistTracks(access_token, playlistId, tracksToAdd);
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
