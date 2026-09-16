// Import DZR utils
import {
  getPlaylistTracks,
  deletePlaylistTracks
} from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
const logger = setLogger('remove-duplicates');
// Import types
import { Playlist, DeezerTrack } from '../types';

// Two tracks are the same song when the artist and the duration match but the
// album differs: a reissue, or the same track on an album and on an EP.
const isSameSong = (track: DeezerTrack, other: DeezerTrack): boolean =>
  track.artist.id === other.artist.id &&
  track.album.id !== other.album.id &&
  track.duration === other.duration;

export default async function removeDuplicates({ playlistId, access_token }: Playlist) {
  try {
    logger.info('Script started');

    // GET PLAYLIST CONTENT
    const data = await getPlaylistTracks(access_token, playlistId);
    if (!data.error) {
      // GROUP TRACKS BY TITLE, PARENTHESES ASIDE
      const tracksByTitle = new Map<string, DeezerTrack[]>();
      for (const track of data.data as DeezerTrack[]) {
        const title = track.title_short.replace(/ *\([^)]*\) */g, '');
        const sameTitle = tracksByTitle.get(title);
        if (sameTitle) {
          sameTitle.push(track);
        } else {
          tracksByTitle.set(title, [track]);
        }
      }

      // OF TWO COPIES OF A SONG, THE LAST ADDED ONE GOES
      const tracksToRemove = new Set<number>();
      for (const tracks of tracksByTitle.values()) {
        if (tracks.length < 2) {
          continue;
        }
        tracks.forEach((track, index) => {
          tracks.forEach((other, otherIndex) => {
            if (index !== otherIndex && isSameSong(track, other) && track.time_add > other.time_add) {
              tracksToRemove.add(track.id);
            }
          });
        });
      }

      // REMOVE TRACKS FROM PLAYLIST
      if (tracksToRemove.size) {
        const removed = Array.from(tracksToRemove);
        await deletePlaylistTracks(access_token, playlistId, removed);
        logger.info({
          action: 'tracks-removed',
          playlist: playlistId,
          tracks: removed,
        });
      }

      logger.info('Script ended');
    } else {
      logger.error('API Error Response', data.error);
    }
  } catch (e) {
    logger.error(e);
  }
}
