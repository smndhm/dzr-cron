// Import DZR utils
import { getPlaylistTracks, deletePlaylistTracks, postPlaylistTracks } from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
// Import run summary
import { reportChange } from '../utils/summary';
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
}: Playlist & { playlists: AtLeastOne<Playlist> } & { nbTracks?: number } & { noExplicitLyrics?: boolean }) {
  try {
    logger.info('Script started');

    // GET PLAYLISTS CONTENT
    // A source that could not be read is not an empty source. The destination
    // is set to exactly what was selected, so going on with the ones that did
    // answer would take that person's tracks out of it — the playlist would
    // quietly shrink by ten on the day their token or their playlist hiccups.
    // The run stops instead, having written nothing, and the next one syncs.
    const dzrPlaylists: DeezerTrack[][] = [];
    for await (const playlist of playlists) {
      const data = await getPlaylistTracks(playlist.access_token, playlist.playlistId);
      if (data.error) {
        logger.error(`Could not read playlist ${playlist.playlistId}, leaving the destination alone.`, data.error);
        return;
      }
      dzrPlaylists.push(data.data);
    }

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
