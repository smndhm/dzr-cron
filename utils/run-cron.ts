// Import cron tasks
import lastTracks from '../cron-scripts/last-tracks';
import syncPlaylists from '../cron-scripts/sync-playlists';
import removeDuplicates from '../cron-scripts/remove-duplicates';
// Import types
import { Cron } from './cron-conf';

// Runs a single cron task, whatever triggers it
export default async function runCron (cron: Cron): Promise<void> {
  switch (cron.action) {
  case 'last-tracks':
    await lastTracks(cron.arguments);
    break;
  case 'sync-playlists':
    await syncPlaylists(cron.arguments);
    break;
  case 'remove-duplicates':
    await removeDuplicates(cron.arguments);
    break;
  }
}
