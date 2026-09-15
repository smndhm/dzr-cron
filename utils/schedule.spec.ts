import { assertValidCronExpression, TIMEZONE } from './schedule';

describe('Schedule', () => {
  test('Should evaluate the local crons in Europe/Paris', () => {
    expect(TIMEZONE).toBe('Europe/Paris');
  });

  test('Should accept a valid expression', () => {
    expect(() => assertValidCronExpression('0 * * * *', 'cron #0')).not.toThrow();
    expect(() => assertValidCronExpression('*/30 9-18 * * 1-5', 'cron #0')).not.toThrow();
  });

  test('Should throw a labelled error on an invalid expression', () => {
    expect(() => assertValidCronExpression('99 99 * * *', 'cron #0')).toThrow('cron #0');
    expect(() => assertValidCronExpression('every hour', 'cron #0')).toThrow('invalid cron expression');
  });
});
