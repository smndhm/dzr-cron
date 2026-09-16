// Import cron task runner
import runCron from './utils/run-cron';
// Cron definition, as the workflow handed it over
import loadCron from './utils/cron-conf';
// Import token collection
import { collectTokens } from './utils/mask-tokens';
// Import logger
import setLogger, { getErrorCount, resetErrorCount, registerSecrets, LogOutput } from './utils/logger';
// Import run summary
import { forgetChanges, writeSummary } from './utils/summary';

// Runs the cron the workflow defined, then returns the number of logged errors
// so the caller can exit accordingly.
export default async function runOnce (env: NodeJS.ProcessEnv = process.env, output?: LogOutput): Promise<number> {
  const logger = setLogger('run-once', output);
  resetErrorCount();
  forgetChanges();

  const cron = loadCron(env);
  // Before anything can log, so a failed request cannot print a token
  registerSecrets(collectTokens(cron));

  logger.info({ action: 'cron-started', cron: cron.name });
  try {
    await runCron(cron);
  } catch (e) {
    logger.error(e);
  }

  const errors = getErrorCount();
  logger.info({ action: 'cron-ended', cron: cron.name, errors });
  // Reads better than the log, at the top of the run's page
  writeSummary(cron.name, errors, env);
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
