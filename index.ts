// import cron tasks
import { CronJob } from 'cron';
import lastTracks from './cron-scripts/last-tracks';
import syncPlaylists from './cron-scripts/sync-playlists';
import removeDuplicates from './cron-scripts/remove-duplicates';
// Crons parameters
import crons from './crons.conf';

// Start all cron tasks
for (const cron of crons) {
  const dzrCronJob = new CronJob(
    cron.refreshInterval,
    () => {
      switch (cron.action) {
      case 'last-tracks':
        lastTracks(cron.arguments);
        break;
      case 'sync-playlists':
        syncPlaylists(cron.arguments);
        break;
      case 'remove-duplicates':
        removeDuplicates(cron.arguments);
        break;
      }
    },
    null,
    true,
    'Europe/Paris',
    this,
    true
  );
  dzrCronJob.start();
}
