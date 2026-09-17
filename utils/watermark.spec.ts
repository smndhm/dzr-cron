import { asDate, readWatermark, writeWatermark } from './watermark';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe('watermark', () => {
  describe('readWatermark', () => {
    test('reads the day written down, moved back by the lag', () => {
      expect(readWatermark('[dzr-cron:2026-09-17]')).toBe('2026-09-15');
    });

    test('finds the mark after whatever the owner wrote', () => {
      expect(readWatermark('Mes sorties [dzr-cron:2026-09-17]')).toBe('2026-09-15');
    });

    test('has nothing to say about a description without a mark', () => {
      expect(readWatermark('Mes sorties')).toBeUndefined();
    });

    test('has nothing to say about a playlist with no description at all', () => {
      expect(readWatermark(undefined)).toBeUndefined();
      expect(readWatermark(null)).toBeUndefined();
    });

    test('ignores something shaped like a mark but not a date', () => {
      expect(readWatermark('[dzr-cron:hier]')).toBeUndefined();
    });
  });

  describe('writeWatermark', () => {
    test('adds a mark to a description that has none', () => {
      expect(writeWatermark('Mes sorties', '2026-09-17'))
        .toBe('Mes sorties [dzr-cron:2026-09-17]');
    });

    test('replaces its own mark rather than stacking a second', () => {
      expect(writeWatermark('Mes sorties [dzr-cron:2020-01-01]', '2026-09-17'))
        .toBe('Mes sorties [dzr-cron:2026-09-17]');
    });

    test('writes only the mark on an empty description', () => {
      expect(writeWatermark('', '2026-09-17')).toBe('[dzr-cron:2026-09-17]');
    });
  });

  test('asDate keeps the day and drops the time', () => {
    expect(asDate(day('2026-09-17') + 23 * 60 * 60 * 1000)).toBe('2026-09-17');
  });
});
