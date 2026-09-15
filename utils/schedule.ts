// Import cron parser
import { CronTime } from 'cron';

// Timezone used to evaluate every cron expression
export const TIMEZONE = 'Europe/Paris';
// How far back we look for a missed occurrence, in minutes
export const DEFAULT_WINDOW_MINUTES = 60;

type DueOptions = {
  now?: Date;
  windowMinutes?: number;
  timezone?: string;
};

// Throws if the expression cannot be parsed by the cron package
export const assertValidCronExpression = (refreshInterval: string, label: string): void => {
  try {
    new CronTime(refreshInterval, TIMEZONE);
  } catch (e) {
    throw new Error(`${label}: invalid cron expression "${refreshInterval}".`);
  }
};

// Tells whether the expression had an occurrence in ]now - windowMinutes, now].
// GitHub Actions wakes the runner up on its own schedule, so each cron still
// decides here whether it was actually due since the previous wake up.
export const isDue = (refreshInterval: string, {
  now = new Date(),
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  timezone = TIMEZONE,
}: DueOptions = {}): boolean => {
  const cronTime = new CronTime(refreshInterval, timezone);
  // `sendAt` can only look ahead from the current time, `_getNextDateFrom` is
  // the only entry point that accepts an arbitrary starting point. Guarded so a
  // cron major bump fails loudly instead of silently skipping every task.
  if (typeof cronTime._getNextDateFrom !== 'function') {
    throw new Error('Unsupported cron version: CronTime._getNextDateFrom is missing.');
  }
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  // Returns the first occurrence strictly after windowStart
  const nextOccurrence = cronTime._getNextDateFrom(windowStart, timezone);
  return nextOccurrence.valueOf() <= now.valueOf();
};
