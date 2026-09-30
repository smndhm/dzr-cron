import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasState, readPoured, prunePoured, writePoured } from './state';

const scratch = () => join(mkdtempSync(join(tmpdir(), 'dzr-state-')), 'poured.json');

describe('state', () => {
  describe('hasState', () => {
    test('is false when nothing checked the branch out', () => {
      expect(hasState('/nowhere/at/all/poured.json')).toBeFalsy();
    });

    test('is true as soon as the directory is there, file or not', () => {
      const file = scratch();
      expect(hasState(file)).toBeTruthy();
    });
  });

  describe('readPoured', () => {
    test('reads back what was written', () => {
      const file = scratch();
      writePoured({ 101: '2026-09-30', 102: '2026-09-29' }, file);
      expect(readPoured(file)).toEqual({ 101: '2026-09-30', 102: '2026-09-29' });
    });

    test('is empty on a first run, when the file is not there yet', () => {
      expect(readPoured(scratch())).toEqual({});
    });

    test('throws on a file that does not hold an object', () => {
      const file = scratch();
      writeFileSync(file, '["101"]');
      expect(() => readPoured(file)).toThrow();
    });

    // Anything the script did not write is dropped rather than trusted, so one
    // hand edit cannot make the add filter compare against nonsense
    test('keeps only numeric ids mapped to a string', () => {
      const file = scratch();
      writeFileSync(file, '{"101":"2026-09-30","oops":"2026-09-30","102":7}');
      expect(readPoured(file)).toEqual({ 101: '2026-09-30' });
    });
  });

  describe('prunePoured', () => {
    // An id is only worth keeping while its album can still fall inside the
    // window. Past that, no run will ever look at the album again.
    test('drops an album that fell out of the window and keeps its edge', () => {
      expect(
        prunePoured(
          { 101: '2026-09-10', 102: '2026-09-15', 103: '2026-09-30' },
          '2026-09-15',
        ),
      ).toEqual({ 102: '2026-09-15', 103: '2026-09-30' });
    });
  });

  describe('writePoured', () => {
    test('creates the directory when the checkout left none', () => {
      const file = join(mkdtempSync(join(tmpdir(), 'dzr-state-')), 'deeper', 'poured.json');
      writePoured({ 101: '2026-09-30' }, file);
      expect(readPoured(file)).toEqual({ 101: '2026-09-30' });
    });

    // Sorted, so a commit shows what changed rather than a reshuffled object
    test('writes the ids in order', () => {
      const file = scratch();
      writePoured({ 300: '2026-09-30', 100: '2026-09-30', 200: '2026-09-30' }, file);
      expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')))).toEqual(['100', '200', '300']);
    });

    test('leaves a trailing newline, as a committed file should', () => {
      const file = scratch();
      writePoured({ 101: '2026-09-30' }, file);
      expect(readFileSync(file, 'utf8').endsWith('}\n')).toBeTruthy();
    });
  });

  test('survives a directory that exists with an unreadable file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dzr-state-'));
    mkdirSync(join(directory, 'poured.json'));
    expect(() => readPoured(join(directory, 'poured.json'))).toThrow();
  });
});
