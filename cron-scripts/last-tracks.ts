// Import DZR utils
import { getPlaylistTracks, deletePlaylistTracks, postPlaylistTracks } from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
// Import run summary
import { reportChange } from '../utils/summary';
const logger = setLogger('last-tracks');
// Import types
import { AtLeastOne, Playlist, DeezerTrack } from '../types';

const DAY_SECONDS = 24 * 60 * 60;

// Script
export default async function lastTracks({
  playlistId,
  access_token,
  playlists,
  nbTracks = 50,
  noExplicitLyrics = false,
  addedWithinDays,
}: Playlist & { playlists: AtLeastOne<Playlist> } & { nbTracks?: number } & { noExplicitLyrics?: boolean } & {
  addedWithinDays?: number;
}) {
  try {
    logger.info('Script started');

    // GET PLAYLISTS CONTENT
    const dzrPlaylists: DeezerTrack[][] = [];
    for await (const playlist of playlists) {
      const data = await getPlaylistTracks(playlist.access_token, playlist.playlistId);
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

    // A track someone added to their playlist long ago is not news any more,
    // however near the top of their playlist it sits. Deezer gives time_add in
    // seconds. No argument means no limit, which is what the car playlist wants.
    const addedSince = addedWithinDays ? Date.now() / 1000 - addedWithinDays * DAY_SECONDS : 0;

    const dzrTracksId: number[] = [];
    // Membership is checked once per track of every playlist, so a Set rather
    // than a scan of the ids kept so far
    const keptTracksId = new Set<number>();
    for (const playlistTracks of dzrPlaylists) {
      playlistTracks
        // most recent first
        .toSorted((a, b) => b.time_add - a.time_add)
        // filter tracks
        .filter(
          track =>
            track.readable && // this params is sometimes not correct...
            track.time_add >= addedSince && // added to its own playlist recently enough
            (!noExplicitLyrics || !track.explicit_lyrics) && // remove tracks with explicit lyrics
            !keptTracksId.has(track.id),
        )
        // limit to N tracks
        .slice(0, nbTracks)
        // Add tracks
        .forEach(track => {
          keptTracksId.add(track.id);
          dzrTracksId.push(track.id);
        });
    }

    // GET DESTINATION PLAYLIST TRACKS
    const { data: dzrDestinationPlaylistTracks } = await getPlaylistTracks(access_token, playlistId);

    const dzrDestinationPlaylistTracksId: number[] = dzrDestinationPlaylistTracks.map((track: DeezerTrack) => track.id);
    const destinationTracksId = new Set(dzrDestinationPlaylistTracksId);

    // REMOVE TRACKS FROM PLAYLIST
    const tracksToRemove = dzrDestinationPlaylistTracksId.filter(track => !keptTracksId.has(track));
    if (tracksToRemove.length) {
      await deletePlaylistTracks(access_token, playlistId, tracksToRemove);
      reportChange(logger, {
        action: 'tracks-removed',
        playlist: playlistId,
        tracks: tracksToRemove,
      });
    }

    // GET TRACKS TO ADD
    const tracksToAdd = dzrTracksId.filter(track => !destinationTracksId.has(track));
    if (tracksToAdd.length) {
      await postPlaylistTracks(access_token, playlistId, tracksToAdd);
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
