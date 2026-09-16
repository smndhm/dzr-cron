import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import setLogger from './logger';
import { reportChange, renderSummary, writeSummary, forgetChanges } from './summary';

const silent = () => setLogger('test', () => undefined);

describe('Run summary', () => {
  beforeEach(() => {
    forgetChanges();
  });

  test('Should say what changed, playlist by playlist', () => {
    reportChange(silent(), { action: 'tracks-added', playlist: 9499677562, tracks: [1, 2, 3] });
    reportChange(silent(), { action: 'tracks-removed', playlist: 9499677562, tracks: [4] });
    reportChange(silent(), { action: 'tracks-ordered', playlist: 1008179901 });

    expect(renderSummary('family-playlist', 0)).toBe([
      '## family-playlist',
      '',
      '- 3 tracks added to playlist 9499677562',
      '- 1 track removed from playlist 9499677562',
      '- playlist 1008179901 reordered',
      '',
    ].join('\n'));
  });

  test('Should say so when nothing changed', () => {
    expect(renderSummary('thibaut', 0)).toContain('Nothing to change.');
  });

  test('Should point at the log when the run failed', () => {
    expect(renderSummary('thibaut', 1)).toContain('**1 error**, see the log below.');
    expect(renderSummary('thibaut', 2)).toContain('**2 errors**, see the log below.');
  });

  test('Should also log the change it records', () => {
    const lines: string[] = [];
    reportChange(setLogger('last-tracks', (line) => lines.push(line)), {
      action: 'tracks-added',
      playlist: 1,
      tracks: [7],
    });

    expect(lines[0]).toBe('INFO [last-tracks] {"action":"tracks-added","playlist":1,"tracks":[7]}');
  });

  test('Should forget the changes between runs', () => {
    reportChange(silent(), { action: 'tracks-added', playlist: 1, tracks: [7] });
    forgetChanges();

    expect(renderSummary('thibaut', 0)).toContain('Nothing to change.');
  });

  describe('writeSummary', () => {
    test('Should append to the file GitHub gives it', () => {
      const file = join(mkdtempSync(join(tmpdir(), 'summary-')), 'summary.md');
      reportChange(silent(), { action: 'tracks-added', playlist: 1, tracks: [7] });

      writeSummary('thibaut', 0, { GITHUB_STEP_SUMMARY: file });
      writeSummary('lucas', 0, { GITHUB_STEP_SUMMARY: file });

      const written = readFileSync(file, 'utf8');
      expect(written).toContain('## thibaut');
      expect(written).toContain('## lucas');
      expect(written).toContain('1 track added to playlist 1');
    });

    test('Should write nothing outside a runner', () => {
      const file = join(mkdtempSync(join(tmpdir(), 'summary-')), 'summary.md');

      writeSummary('thibaut', 0, {});

      expect(existsSync(file)).toBe(false);
    });
  });
});
