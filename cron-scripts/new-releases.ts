// Import DZR utils
import {
  getFavouriteArtists,
  getBatch,
  getPlaylistTracks,
  postPlaylistTracks,
} from '../utils/dzr';
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
const batchData = <T>(batchResult: { data?: T[], error?: unknown }[]): T[] =>
  batchResult.flatMap((entry) => {
    if (entry.error) {
      logger.error('API Error Response', entry.error);
      return [];
    }
    return entry.data ?? [];
  });

// Script
export default async function newReleases({
  playlistId,
  access_token,
  days = 15,
  recordTypes,
}: Playlist & {days?: number} & {recordTypes?: string[]}) {
  try {
    logger.info('Script started');

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
      albums.push(...batchData<DeezerAlbum>(batch_result));
    }

    // KEEP THE RECENT ONES
    // Dates compare as strings in this format, and release_date has no time,
    // so the window starts at midnight UTC of its first day.
    const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
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
      logger.info('No release in the window');
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
        ...batchData<DeezerTrack>(batch_result).map((track) => track.id),
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

    logger.info('Script ended');
  } catch (e) {
    logger.error(e);
  }
}
