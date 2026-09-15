// Import cron tasks runner
import runCron from './utils/run-cron';
// Crons parameters
import loadCrons, { selectCrons } from './utils/crons-conf';
// Import logger
import setLogger, { getErrorCount, resetErrorCount } from './utils/logger';

const logger = setLogger('run-once');

// Comma separated list of cron names, set by the workflow that schedules them
export const CRON_NAMES_ENV = 'CRON_NAMES';

// Runs the crons named in CRON_NAMES once, then returns the number of logged
// errors so the caller can exit accordingly. The schedule itself belongs to the
// workflow: this only decides what runs, never when.
export default async function runOnce (env: NodeJS.ProcessEnv = process.env): Promise<number> {
  resetErrorCount();

  const crons = selectCrons(loadCrons(env), env[CRON_NAMES_ENV] ?? '');

  if (crons.length === 0) {
    // Nothing to do rather than a failure: the job would otherwise turn red
    // every hour on a fork, or before the CRONS_CONF secret is set.
    logger.warn('No cron configured.');
  }

  logger.info({ action: 'crons-selected', crons: crons.map(({ name }) => name) });

  // One at a time, to stay within the Deezer API quota
  for (const cron of crons) {
    await runCron(cron);
  }

  const errors = getErrorCount();
  logger.info({ action: 'run-ended', ran: crons.length, errors });
  return errors;
}

// Entry point, `npm run cron:once`
if (require.main === module) {
  runOnce()
    .then((errors) => {
      process.exitCode = errors > 0 ? 1 : 0;
    })
    .catch((e) => {
      logger.error(e);
      process.exitCode = 1;
    });
}
