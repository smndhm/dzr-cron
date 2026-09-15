// import cron scheduler
import { CronJob } from 'cron';
// import cron tasks runner
import runCron from './utils/run-cron';
// Crons parameters
import loadCrons from './utils/crons-conf';
// Timezone
import { TIMEZONE } from './utils/schedule';
// Import logger
import setLogger from './utils/logger';

const logger = setLogger('index');

const crons = loadCrons();

// Start all cron tasks
for (const cron of crons) {
  // Crons scheduled by a GitHub workflow carry no refreshInterval of their own
  if (!cron.refreshInterval) {
    logger.warn(`"${cron.name}" has no refreshInterval, skipped.`);
    continue;
  }

  const dzrCronJob = new CronJob(
    cron.refreshInterval,
    () => {
      runCron(cron);
    },
    null,
    true,
    TIMEZONE,
    this,
    true
  );
  dzrCronJob.start();
}
