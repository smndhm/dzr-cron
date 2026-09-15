// Import cron parser
import { CronTime } from 'cron';

// Timezone used by `npm run start` to evaluate every cron expression
export const TIMEZONE = 'Europe/Paris';

// Throws if the expression cannot be parsed by the cron package
export const assertValidCronExpression = (refreshInterval: string, label: string): void => {
  try {
    new CronTime(refreshInterval, TIMEZONE);
  } catch (e) {
    throw new Error(`${label}: invalid cron expression "${refreshInterval}".`);
  }
};
