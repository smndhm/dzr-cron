// Import DZR utils
import {
  getPlaylistTracks,
  postPlaylistTracks,
  postPlaylistTracksOrder
} from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
const logger = setLogger('cron-sync-playlists');
// Import types
import { Playlist, AtLeastTwo } from '../types';

// Script
export default async function syncPlaylists(playlists: AtLeastTwo<Playlist>) {
  try {
    logger.info('Script started');

    // GET PLAYLISTS CONTENT
    const dzrPlaylists = [];
    for await (const { access_token, playlistId } of playlists) {
      const data = await getPlaylistTracks(access_token, playlistId);
      if (!data.error) {
        data.id = playlistId;
        data.access_token = access_token;
        dzrPlaylists.push(data);
      } else {
        logger.error('API Error Response', data.error);
      }
    }
	
    // CHECK IF COULD GET DATA FROM ENOUGTH PLAYLISTS
    if (dzrPlaylists.length < 2) {
      logger.error('Not enought valid playlists.');
      return;
    }

    // GET TRACK LIST
    const playlistsTracks = dzrPlaylists
    // GROUP ALL TRACKS
      .reduce((acc, curr) => [...acc, ...curr.data], [])
    // ORDER BY TIME ADD (IF SAME, ORDER BY ID)
      .sort((a: { time_add: number; id: number; }, b: { time_add: number; id: number; }) =>
        a.time_add - b.time_add !== 0 ? a.time_add - b.time_add : a.id - b.id
      )
    // IF 2 TRACKS ARE THE SAME, KEEP FIRST ADDED
      .reduce((acc: { id: number; }[], curr: { id: number; }) => {
        if (acc.map((track: { id: number; }) => track.id).indexOf(curr.id) === -1) {
          acc.push(curr);
        }
        return acc;
      }, [])
    // KEEP IDS
      .map((track: { id: number; }) => track.id);

    // UPDATE PLAYLISTS
    for (const {
      access_token,
      id: playlistId,
      data: playlistTracks,
    } of dzrPlaylists) {

      // GET TRACKS TO ADD
      const playlistTracksId = playlistTracks.map((track: { id: number; }) => track.id);
      const tracksToAdd = playlistsTracks.filter(
        (track) => !playlistTracksId.includes(track)
      );
      if (tracksToAdd.length) {
        await postPlaylistTracks(access_token, playlistId, tracksToAdd);
        logger.info({
          action: 'tracks-added',
          playlist: playlistId,
          tracks: tracksToAdd,
        });
      }

      // UPDATE ORDER
      if (playlistTracksId.join(',') !== playlistsTracks.join(',')) {
        await postPlaylistTracksOrder(access_token, playlistId, playlistsTracks);
        logger.info({
          action: 'tracks-ordered',
          playlist: playlistId
        });
      }
    }

    logger.info('Script ended');
  } catch (e) {
    logger.error(e);
  }
}
