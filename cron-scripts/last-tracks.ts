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
import { AtLeastOne, Playlist, DeezerTrack } from '../types';

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
    const dzrPlaylists: DeezerTrack[][] = [];
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

    const dzrTracksId: number[] = [];
    // Membership is checked once per track of every playlist, so a Set rather
    // than a scan of the ids kept so far
    const keptTracksId = new Set<number>();
    for (const playlistTracks of dzrPlaylists) {
      playlistTracks
        // most recent first
        .sort((a, b) => b.time_add - a.time_add)
        // filter tracks
        .filter(
          (track) =>
            track.readable && // this params is sometimes not correct...
            (!noExplicitLyrics || !track.explicit_lyrics) && // remove tracks with explicit lyrics
            !keptTracksId.has(track.id),
        )
        // limit to N tracks
        .slice(0, nbTracks)
        // Add tracks
        .forEach((track) => {
          keptTracksId.add(track.id);
          dzrTracksId.push(track.id);
        });
    }

    // GET DESTINATION PLAYLIST TRACKS
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId,
    );

    const dzrDestinationPlaylistTracksId: number[] = dzrDestinationPlaylistTracks.map(
      (track: DeezerTrack) => track.id,
    );
    const destinationTracksId = new Set(dzrDestinationPlaylistTracksId);

    // REMOVE TRACKS FROM PLAYLIST
    const tracksToRemove = dzrDestinationPlaylistTracksId.filter(
      (track) => !keptTracksId.has(track),
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
      (track) => !destinationTracksId.has(track),
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
