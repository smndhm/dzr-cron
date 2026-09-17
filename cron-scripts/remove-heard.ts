// Import DZR utils
import {
  getPlaylistTracks,
  getListeningHistory,
  deletePlaylistTracks,
} from '../utils/dzr';
// Import logger
import setLogger from '../utils/logger';
// Import run summary
import { reportChange } from '../utils/summary';
const logger = setLogger('remove-heard');
// Import types
import { Playlist, DeezerTrack } from '../types';

// Script
export default async function removeHeard({ playlistId, access_token }: Playlist) {
  try {
    logger.info('Script started');

    const { data: dzrPlaylistTracks } = await getPlaylistTracks(access_token, playlistId);
    const playlistTracksId: number[] = dzrPlaylistTracks.map(
      (track: DeezerTrack) => track.id,
    );
    if (playlistTracksId.length === 0) {
      logger.info('Nothing in the playlist');
      return;
    }

    const history = await getListeningHistory(access_token);
    if (history.error) {
      logger.error('API Error Response', history.error);
      return;
    }
    const playedTracksId = new Set<number>(
      (history.data ?? []).map((track: DeezerTrack) => track.id),
    );
    // What the history holds is what decides how often this cron has to run:
    // play more tracks than it keeps between two runs and the earliest fall
    // out unseen, leaving those releases in the playlist for good.
    logger.info('Listening history', { tracks: playedTracksId.size });

    const tracksToRemove = playlistTracksId.filter((track) => playedTracksId.has(track));
    if (tracksToRemove.length === 0) {
      logger.info('Nothing heard yet');
      return;
    }

    await deletePlaylistTracks(access_token, playlistId, tracksToRemove);
    reportChange(logger, {
      action: 'tracks-removed',
      playlist: playlistId,
      tracks: tracksToRemove,
    });

    logger.info('Script ended');
  } catch (e) {
    logger.error(e);
  }
}
