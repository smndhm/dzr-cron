import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// The playlist was this cron's memory of what it had already poured in, and
// the removal destroys it: a played track leaves, falls out of the listening
// history within hours, and the next run pours it back in while its album is
// still inside the window. Seven such returns were measured over two weeks.
//
// So the ids taken out are written down. Not in the playlist description:
// Deezer keeps 255 characters of it and drops the rest without a word, which is
// twenty ids where sixty are needed. A file, committed by the workflow.

export type Removed = Record<string, string>;

// The workflow checks the state branch out here. No directory means nothing
// checked it out — a run from a terminal — and the cron works as it did before,
// without the memory. DZR_STATE_FILE moves it, which is how the tests reach it.
const DEFAULT_FILE = '.state/removed.json';

export const stateFile = (env: NodeJS.ProcessEnv = process.env): string =>
  env.DZR_STATE_FILE ?? DEFAULT_FILE;

export const hasState = (file: string = stateFile()): boolean => existsSync(dirname(file));

// Anything unreadable is treated as empty rather than fatal: a first run has no
// file at all, and a corrupt one costs a few tracks poured back in, which is
// what this whole file exists to avoid but is still better than a cron that
// stops running. The caller says so in the log.
export const readRemoved = (file: string = stateFile()): Removed => {
  if (!existsSync(file)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file} does not hold an object.`);
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      ([id, day]) => /^\d+$/.test(id) && typeof day === 'string',
    ),
  ) as Removed;
};

// An id is only worth keeping while its album can still fall inside the
// discovery window. Past that, no run will ever look at the album again.
export const pruneRemoved = (removed: Removed, since: string): Removed =>
  Object.fromEntries(Object.entries(removed).filter(([, day]) => day >= since));

export const writeRemoved = (removed: Removed, file: string = stateFile()): void => {
  mkdirSync(dirname(file), { recursive: true });
  // Sorted, so a commit shows what changed rather than a reshuffled object
  const sorted = Object.keys(removed)
    .sort()
    .reduce<Removed>((all, id) => ({ ...all, [id]: removed[id] }), {});
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
};
