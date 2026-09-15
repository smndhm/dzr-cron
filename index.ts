// import cron scheduler
import { CronJob } from 'cron';
// import cron tasks runner
import runCron from './utils/run-cron';
// Crons parameters
import loadCrons from './utils/crons-conf';
// Timezone shared with the one shot runner
import { TIMEZONE } from './utils/schedule';

const crons = loadCrons();

// Start all cron tasks
for (const cron of crons) {
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
