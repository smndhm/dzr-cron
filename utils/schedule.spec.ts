import { isDue, assertValidCronExpression, DEFAULT_WINDOW_MINUTES, TIMEZONE } from './schedule';

// 2022-03-15T10:17 in Europe/Paris
const now = new Date('2022-03-15T09:17:00Z');

describe('Schedule', () => {
  describe('isDue', () => {
    test('Should be due for an hourly cron', () => {
      expect(isDue('0 * * * *', { now })).toBeTruthy();
    });

    test('Should not be due for a daily cron outside of the window', () => {
      expect(isDue('0 0 * * *', { now })).toBeFalsy();
    });

    test('Should be due for a daily cron inside the window', () => {
      // 2022-03-16T00:17 in Europe/Paris
      const afterMidnight = new Date('2022-03-15T23:17:00Z');
      expect(isDue('0 0 * * *', { now: afterMidnight })).toBeTruthy();
    });

    test('Should use the Europe/Paris timezone', () => {
      // 10:00 in Paris happened 17 minutes ago, 10:00 UTC did not
      expect(isDue('0 10 * * *', { now })).toBeTruthy();
      expect(isDue('0 10 * * *', { now, timezone: 'UTC' })).toBeFalsy();
    });

    test('Should not be due for another day of week', () => {
      // now is a tuesday
      expect(isDue('0 * * * 0', { now })).toBeFalsy();
      expect(isDue('0 * * * 2', { now })).toBeTruthy();
    });

    test('Should honour the window', () => {
      // 10:30 in Paris is in the future, until the window covers a full day
      expect(isDue('30 10 * * *', { now })).toBeFalsy();
      expect(isDue('30 10 * * *', { now, windowMinutes: 24 * 60 })).toBeTruthy();
    });

    test('Should default to a one hour window', () => {
      expect(DEFAULT_WINDOW_MINUTES).toBe(60);
      expect(TIMEZONE).toBe('Europe/Paris');
    });

    test('Should throw on an invalid expression', () => {
      expect(() => isDue('not a cron', { now })).toThrow();
    });
  });

  describe('assertValidCronExpression', () => {
    test('Should accept a valid expression', () => {
      expect(() => assertValidCronExpression('0 * * * *', 'cron #0')).not.toThrow();
    });

    test('Should throw a labelled error on an invalid expression', () => {
      expect(() => assertValidCronExpression('99 99 * * *', 'cron #0')).toThrow('cron #0');
    });
  });
});
