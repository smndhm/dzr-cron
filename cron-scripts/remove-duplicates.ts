// Import DZR utils
import {
  getPlaylistTracks,
  deletePlaylistTracks
} from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
const logger = setLogger('remove-duplicates');
// Import types
import { Playlist } from '../types';

export default async function removeDuplicates({ playlistId, access_token }: Playlist) {
  try {
    logger.info('Script started');

    // GET PLAYLIST CONTENT
    const data = await getPlaylistTracks(access_token, playlistId);
    if (!data.error) {
      // GROUP TRACKS BY ARTIST
      const trackTitles = data.data.reduce((acc, curr) => {
        if (!acc[curr.title_short]) {
          acc[curr.title_short] = [];
        }
        acc[curr.title_short].push({
          artist: {
            id: curr.artist.id, 
          }, 
          album: {
            id: curr.album.id,
          },
          duration: curr.duration,
          time_add: curr.time_add,
          id: curr.id
        });
        return acc;
      }, {});

      // KEEP ARTISTS WITH MORE THAN 1 TRACK
      const sameTitleTracks = Object.keys(trackTitles)
        .filter((id) => trackTitles[id].length > 1)
        .reduce((acc, curr) => {
          acc[curr] = trackTitles[curr];
          return acc;
        }, {});

      // CHECK IF TRACKS ARE THE SAME
      const tracksToRemove = [];
      Object.values(sameTitleTracks).forEach((tracks: { artist: { id: number; }; album: { id: number; }; duration: number; time_add: number; id: number; }[]) => {
        tracks.forEach((track: { artist: { id: number; }; album: { id: number; }; duration: number; time_add: number; id: number; }, index: number) => {
          const otherTracks = [...tracks];
          otherTracks.splice(index, 1);
          otherTracks.forEach((otherTrack) => {
            if (
              track.artist.id === otherTrack.artist.id &&
              track.album.id !== otherTrack.album.id &&
              track.duration === otherTrack.duration &&
              track.time_add > otherTrack.time_add
            ) {
              tracksToRemove.push(track.id);
            }
          });
        });
      });

      // REMOVE TRACKS FROM PLAYLIST
      if (tracksToRemove.length) {
        await deletePlaylistTracks(access_token, playlistId, tracksToRemove);
        logger.info({
          action: 'tracks-removed',
          playlist: playlistId,
          tracks: tracksToRemove,
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
