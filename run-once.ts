// Import cron tasks runner
import runCron from './utils/run-cron';
// Crons parameters
import loadCrons, { selectCrons, CRONS_CONF_FILE } from './utils/crons-conf';
// Import token collection
import { collectTokens } from './utils/mask-tokens';
// Import logger
import setLogger, { getErrorCount, resetErrorCount, registerSecrets, LogOutput } from './utils/logger';

// Comma separated list of cron names, set by the workflow that schedules them
export const CRON_NAMES_ENV = 'CRON_NAMES';

// Runs the crons named in CRON_NAMES once, then returns the number of logged
// errors so the caller can exit accordingly. The schedule itself belongs to the
// workflow: this only decides what runs, never when.
export default async function runOnce (env: NodeJS.ProcessEnv = process.env, file: string = CRONS_CONF_FILE, output?: LogOutput): Promise<number> {
  const logger = setLogger('run-once', output);
  resetErrorCount();

  const allCrons = loadCrons(env, file);
  // Before anything can log, so a failed request cannot print a token
  registerSecrets(collectTokens(allCrons));

  const crons = selectCrons(allCrons, env[CRON_NAMES_ENV] ?? '');

  if (crons.length === 0) {
    // An empty configuration is deliberate, unlike a missing one, which throws
    logger.warn('No cron configured.');
  }

  logger.info({ action: 'crons-selected', crons: crons.map(({ name }) => name) });

  // One at a time, to stay within the Deezer API quota. Two crons can share a
  // script, so the name is logged before its lines, and a failing one is caught
  // here rather than taking the rest of the run down with it.
  for (const cron of crons) {
    logger.info({ action: 'cron-started', cron: cron.name });
    try {
      await runCron(cron);
    } catch (e) {
      logger.error(e);
    }
  }

  const errors = getErrorCount();
  logger.info({ action: 'run-ended', ran: crons.length, errors });
  return errors;
}

// Entry point, `pnpm cron:once`
if (require.main === module) {
  runOnce()
    .then((errors) => {
      process.exitCode = errors > 0 ? 1 : 0;
    })
    .catch((e) => {
      setLogger('run-once').error(e);
      process.exitCode = 1;
    });
}
