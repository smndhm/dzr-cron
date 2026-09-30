import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// The playlist was this cron's memory of what it had already poured in, and it
// loses a track the moment anything takes it out — the cron on a play, or the
// owner deciding they do not want it. The track then reads as new: it is in
// neither the playlist nor the short listening history, and its album is still
// inside the window. Seven such returns were measured over two weeks.
//
// So what has been poured in is written down, which is the rule itself: a
// release is poured in once and never again. Not in the playlist description —
// Deezer keeps 255 characters of it and drops the rest without a word, which is
// twenty ids where sixty are needed. A file, committed by the workflow.
//
// A track id maps to the release date of the album it came from, rather than to
// the day it was poured in: that is the date the window compares against, so an
// id is kept exactly as long as its album can still be looked at. An album not
// out yet keeps its tracks remembered until it is.
export type Poured = Record<string, string>;

// The workflow checks the state branch out here. No directory means nothing
// checked it out — a run from a terminal — and the cron works as it did before,
// without the memory. DZR_STATE_FILE moves it, which is how the tests reach it.
const DEFAULT_FILE = '.state/poured.json';

export const stateFile = (env: NodeJS.ProcessEnv = process.env): string =>
  env.DZR_STATE_FILE ?? DEFAULT_FILE;

export const hasState = (file: string = stateFile()): boolean => existsSync(dirname(file));

// Anything unreadable is treated as empty rather than fatal: a first run has no
// file at all, and a corrupt one costs a few tracks poured back in, which is
// what this whole file exists to avoid but is still better than a cron that
// stops running. The caller says so in the log.
export const readPoured = (file: string = stateFile()): Poured => {
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
  ) as Poured;
};

// An id is only worth keeping while its album can still fall inside the
// discovery window. Past that, no run will ever look at the album again.
export const prunePoured = (poured: Poured, since: string): Poured =>
  Object.fromEntries(Object.entries(poured).filter(([, releaseDate]) => releaseDate >= since));

export const writePoured = (poured: Poured, file: string = stateFile()): void => {
  mkdirSync(dirname(file), { recursive: true });
  // Sorted, so a commit shows what changed rather than a reshuffled object
  const sorted = Object.keys(poured)
    .sort()
    .reduce<Poured>((all, id) => ({ ...all, [id]: poured[id] }), {});
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
};
