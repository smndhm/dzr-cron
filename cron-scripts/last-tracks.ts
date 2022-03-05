// Import DZR utils
import {
  getPlaylistTracks,
  deletePlaylistTracks,
  postPlaylistTracks,
} from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
const logger = setLogger('last-tracks');
// Import types
import { AtLeastOne, Playlist } from '../types';

// Script
export default async function lastTracks({
  playlistId,
  access_token,
  playlists,
  nbTracks = 50,
  noExplicitLyrics = false,
}: Playlist & {playlists: AtLeastOne<Playlist>} & {nbTracks?: number} & {noExplicitLyrics?: boolean}) {
  try {
    logger.info('Script started');

    // GET PLAYLISTS CONTENT
    const dzrPlaylists = [];
    for await (const { access_token, playlistId } of playlists) {
      const data = await getPlaylistTracks(access_token, playlistId);
      if (!data.error) {
        dzrPlaylists.push(data.data);
      } else {
        logger.error('API Error Response', data.error);
      }
    }

    // CHECK IF COULD GET DATA FROM ENOUGTH PLAYLISTS
    if (dzrPlaylists.length === 0) {
      logger.error('Not enought valid playlists.');
      return;
    }

    let dzrTracksId: number[] = [];
    for (let playlistTracks of dzrPlaylists) {
      // most recent first
      playlistTracks.sort(
        (a: { time_add: number }, b: { time_add: number }) =>
          b.time_add - a.time_add,
      );
      // filter tracks
      playlistTracks = playlistTracks.filter(
        (track: { readable: boolean; explicit_lyrics: boolean; id: number }) =>
          track.readable && // this params is sometimes not correct...
          (!noExplicitLyrics || !track.explicit_lyrics) && // remove tracks with explicit lyrics
          !dzrTracksId.includes(track.id),
      );
      // limit to N tracks
      playlistTracks = playlistTracks.slice(0, nbTracks);
      // Add tracks
      dzrTracksId = [
        ...dzrTracksId,
        ...playlistTracks.map((track: { id: number }) => track.id),
      ];
    }

    // GET DESTINATION PLAYLIST TRACKS
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId,
    );

    const dzrDestinationPlaylistTracksId = dzrDestinationPlaylistTracks.map(
      (track: { id: number }) => track.id,
    );

    // REMOVE TRACKS FROM PLAYLIST
    const tracksToRemove = dzrDestinationPlaylistTracksId.filter(
      (track) => !dzrTracksId.includes(track),
    );
    if (tracksToRemove.length) {
      await deletePlaylistTracks(access_token, playlistId, tracksToRemove);
      logger.info({
        action: 'tracks-removed',
        playlist: playlistId,
        tracks: tracksToRemove,
      });
    }

    // GET TRACKS TO ADD
    const tracksToAdd = dzrTracksId.filter(
      (track) => !dzrDestinationPlaylistTracksId.includes(track),
    );
    if (tracksToAdd.length) {
      await postPlaylistTracks(access_token, playlistId, tracksToAdd);
      logger.info({
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
