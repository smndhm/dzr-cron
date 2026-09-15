// Import types
import {
  LastTracksCron,
  SyncPlaylistCron,
  RemoveDuplicatesCron,
} from '../types';

export type Crons = (LastTracksCron|SyncPlaylistCron|RemoveDuplicatesCron)[];

// Environment variable holding the whole configuration as JSON
export const CRONS_CONF_ENV = 'CRONS_CONF';

const ACTIONS = ['last-tracks', 'sync-playlists', 'remove-duplicates'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A playlist is an access_token / playlistId pair
const isPlaylist = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.access_token === 'string' &&
  value.access_token.length > 0 &&
  typeof value.playlistId === 'number';

// Error messages never include the configuration values themselves: they end up
// in public GitHub Actions logs and would leak the Deezer access tokens.
const assertArguments = (action: string, cronArguments: unknown, label: string): void => {
  if (action === 'sync-playlists') {
    if (!Array.isArray(cronArguments) || cronArguments.length < 2) {
      throw new Error(`${label}: "sync-playlists" needs an array of at least two playlists.`);
    }
    if (!cronArguments.every(isPlaylist)) {
      throw new Error(`${label}: every playlist needs an "access_token" string and a "playlistId" number.`);
    }
    return;
  }

  if (!isPlaylist(cronArguments)) {
    throw new Error(`${label}: "arguments" needs an "access_token" string and a "playlistId" number.`);
  }

  if (action === 'last-tracks') {
    const { playlists, nbTracks, noExplicitLyrics } = cronArguments as Record<string, unknown>;
    if (!Array.isArray(playlists) || playlists.length < 1 || !playlists.every(isPlaylist)) {
      throw new Error(`${label}: "last-tracks" needs a "playlists" array of at least one playlist.`);
    }
    if (nbTracks !== undefined && typeof nbTracks !== 'number') {
      throw new Error(`${label}: "nbTracks" must be a number.`);
    }
    if (noExplicitLyrics !== undefined && typeof noExplicitLyrics !== 'boolean') {
      throw new Error(`${label}: "noExplicitLyrics" must be a boolean.`);
    }
  }
};

// Validates an unknown value coming from the environment
export const parseCrons = (value: unknown): Crons => {
  if (!Array.isArray(value)) {
    throw new Error(`${CRONS_CONF_ENV} must be a JSON array of crons.`);
  }

  const names = new Set<string>();

  value.forEach((cron, index) => {
    const label = `${CRONS_CONF_ENV} cron #${index}`;
    if (!isRecord(cron)) {
      throw new Error(`${label}: must be an object.`);
    }
    if (typeof cron.name !== 'string' || cron.name.trim().length === 0) {
      throw new Error(`${label}: missing "name".`);
    }
    if (names.has(cron.name)) {
      throw new Error(`${label}: duplicated name "${cron.name}".`);
    }
    names.add(cron.name);
    if (typeof cron.action !== 'string' || !ACTIONS.includes(cron.action)) {
      throw new Error(`${label}: "action" must be one of ${ACTIONS.join(', ')}.`);
    }
    assertArguments(cron.action, cron.arguments, label);
  });

  return value as Crons;
};

// Keeps the crons named in `names`, in the configuration order. An unknown name
// throws rather than running nothing: it means a workflow and the configuration
// disagree, and a silent no-op would look exactly like a healthy run.
export const selectCrons = (crons: Crons, names: string): Crons => {
  const wanted = names
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (wanted.length === 0) {
    return crons;
  }

  const configured = new Set(crons.map(({ name }) => name));
  const unknown = wanted.filter((name) => !configured.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown cron name: ${unknown.join(', ')}.`);
  }

  return crons.filter(({ name }) => wanted.includes(name));
};

// Reads the configuration from the environment: the tokens it holds cannot live
// in a committed file, so it comes from a GitHub secret.
export default function loadCrons (env: NodeJS.ProcessEnv = process.env): Crons {
  const raw = env[CRONS_CONF_ENV];
  if (!raw || raw.trim().length === 0) {
    throw new Error(`${CRONS_CONF_ENV} is not set.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${CRONS_CONF_ENV} is not valid JSON.`);
  }

  return parseCrons(parsed);
}
