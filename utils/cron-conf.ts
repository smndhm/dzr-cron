// Import types
import {
  LastTracksCron,
  SyncPlaylistCron,
  RemoveDuplicatesCron,
} from '../types';

export type Cron = LastTracksCron | SyncPlaylistCron | RemoveDuplicatesCron;

// A cron is defined by the workflow that schedules it, so its definition
// travels in the environment rather than in a file of its own.
export const CRON_NAME_ENV = 'CRON_NAME';
export const CRON_ACTION_ENV = 'CRON_ACTION';
export const CRON_ARGUMENTS_ENV = 'CRON_ARGUMENTS';

// An access_token is always "$NAME", never a token. The workflows are public,
// so a literal value has to fail loudly instead of being quietly committed.
const TOKEN_PLACEHOLDER = /^\$[A-Z][A-Z0-9_]*$/;

const ACTIONS = ['last-tracks', 'sync-playlists', 'remove-duplicates'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A playlist is an access_token placeholder / playlistId pair
const isPlaylist = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.access_token === 'string' &&
  TOKEN_PLACEHOLDER.test(value.access_token) &&
  typeof value.playlistId === 'number';

const assertArguments = (action: string, cronArguments: unknown): void => {
  if (action === 'sync-playlists') {
    if (!Array.isArray(cronArguments) || cronArguments.length < 2) {
      throw new Error(`${CRON_ARGUMENTS_ENV}: "sync-playlists" needs an array of at least two playlists.`);
    }
    if (!cronArguments.every(isPlaylist)) {
      throw new Error(`${CRON_ARGUMENTS_ENV}: every playlist needs an "access_token" placeholder such as "$MY_ACCESS_TOKEN" and a "playlistId" number.`);
    }
    return;
  }

  if (!isPlaylist(cronArguments)) {
    throw new Error(`${CRON_ARGUMENTS_ENV}: needs an "access_token" placeholder such as "$MY_ACCESS_TOKEN" and a "playlistId" number.`);
  }

  if (action === 'last-tracks') {
    const { playlists, nbTracks, noExplicitLyrics } = cronArguments as Record<string, unknown>;
    if (!Array.isArray(playlists) || playlists.length < 1 || !playlists.every(isPlaylist)) {
      throw new Error(`${CRON_ARGUMENTS_ENV}: "last-tracks" needs a "playlists" array of at least one playlist.`);
    }
    if (nbTracks !== undefined && typeof nbTracks !== 'number') {
      throw new Error(`${CRON_ARGUMENTS_ENV}: "nbTracks" must be a number.`);
    }
    if (noExplicitLyrics !== undefined && typeof noExplicitLyrics !== 'boolean') {
      throw new Error(`${CRON_ARGUMENTS_ENV}: "noExplicitLyrics" must be a boolean.`);
    }
  }
};

// Validates the three values a workflow hands over
export const parseCron = (name: unknown, action: unknown, cronArguments: unknown): Cron => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`${CRON_NAME_ENV} is not set.`);
  }
  if (typeof action !== 'string' || !ACTIONS.includes(action)) {
    throw new Error(`${CRON_ACTION_ENV} must be one of ${ACTIONS.join(', ')}.`);
  }
  assertArguments(action, cronArguments);

  return { name, action, arguments: cronArguments } as Cron;
};

// Swaps each "$NAME" placeholder for the secret of that name. Never names the
// value in an error, only the placeholder.
export const resolveTokens = (cron: Cron, env: NodeJS.ProcessEnv): Cron => {
  const missing = new Set<string>();

  const fill = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(fill);
    }
    if (!isRecord(value)) {
      return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      if (key !== 'access_token' || typeof entry !== 'string') {
        return [key, fill(entry)];
      }
      const name = entry.slice(1);
      const token = env[name];
      if (!token) {
        missing.add(name);
      }
      return [key, token ?? entry];
    }));
  };

  const resolved = fill(cron) as Cron;

  if (missing.size > 0) {
    throw new Error(`Missing secret: ${Array.from(missing).join(', ')}.`);
  }

  return resolved;
};

// Reads the cron the workflow defined, and fills in the tokens from the secrets
export default function loadCron (env: NodeJS.ProcessEnv = process.env): Cron {
  const raw = env[CRON_ARGUMENTS_ENV];
  let cronArguments: unknown;
  try {
    cronArguments = JSON.parse(raw ?? '');
  } catch (cause) {
    // The workflows carry no token, so the parse error is safe to keep: it says
    // which line is malformed, which this message cannot.
    throw new Error(`${CRON_ARGUMENTS_ENV} is not valid JSON.`, { cause });
  }

  return resolveTokens(parseCron(env[CRON_NAME_ENV], env[CRON_ACTION_ENV], cronArguments), env);
}
