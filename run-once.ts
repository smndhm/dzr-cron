// Import cron tasks runner
import runCron from './utils/run-cron';
// Crons parameters
import loadCrons from './utils/crons-conf';
// Import schedule helpers
import { isDue, DEFAULT_WINDOW_MINUTES } from './utils/schedule';
// Import logger
import setLogger, { getErrorCount, resetErrorCount } from './utils/logger';

const logger = setLogger('run-once');

export const WINDOW_MINUTES_ENV = 'CRON_WINDOW_MINUTES';
export const RUN_ALL_ENV = 'RUN_ALL_CRONS';

const getWindowMinutes = (env: NodeJS.ProcessEnv): number => {
  const raw = env[WINDOW_MINUTES_ENV];
  if (!raw) {
    return DEFAULT_WINDOW_MINUTES;
  }
  const windowMinutes = Number(raw);
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
    throw new Error(`${WINDOW_MINUTES_ENV} must be a positive number of minutes.`);
  }
  return windowMinutes;
};

// Runs every cron due since the previous run, then returns the number of logged
// errors so the caller can exit accordingly.
export default async function runOnce (env: NodeJS.ProcessEnv = process.env): Promise<number> {
  resetErrorCount();

  const crons = loadCrons(env);
  const windowMinutes = getWindowMinutes(env);
  const runAll = env[RUN_ALL_ENV] === 'true';
  const dueCrons = runAll
    ? crons
    : crons.filter(({ refreshInterval }) => isDue(refreshInterval, { windowMinutes }));

  if (crons.length === 0) {
    // Nothing to do rather than a failure: the job would otherwise turn red
    // every hour on a fork, or before the CRONS_CONF secret is set.
    logger.warn('No cron configured.');
  }

  logger.info({
    action: 'crons-selected',
    configured: crons.length,
    due: dueCrons.length,
    windowMinutes,
    runAll,
  });

  // One at a time, to stay within the Deezer API quota
  for (const cron of dueCrons) {
    await runCron(cron);
  }

  const errors = getErrorCount();
  logger.info({ action: 'run-ended', ran: dueCrons.length, errors });
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
