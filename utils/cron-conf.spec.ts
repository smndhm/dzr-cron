import loadCron, {
  parseCron,
  resolveTokens,
  CRON_NAME_ENV,
  CRON_ACTION_ENV,
  CRON_ARGUMENTS_ENV,
  Cron,
} from './cron-conf';
import { Playlist } from '../types';

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const secrets = {
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
};

const syncArguments = [
  { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 },
  { access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 },
];

const lastTracksArguments = {
  access_token: '$MY_ACCESS_TOKEN',
  playlistId: 1234567890,
  playlists: [{ access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 }],
  nbTracks: 10,
  noExplicitLyrics: true,
};

const playlistArguments = { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 };

const env = (overrides: NodeJS.ProcessEnv = {}) => ({
  ...secrets,
  [CRON_NAME_ENV]: 'kids-playlist',
  [CRON_ACTION_ENV]: 'sync-playlists',
  [CRON_ARGUMENTS_ENV]: JSON.stringify(syncArguments),
  ...overrides,
});

describe('Cron configuration', () => {
  describe('loadCron', () => {
    test('Should read the cron the workflow defined and fill in the tokens', () => {
      const cron = loadCron(env());

      expect(cron.name).toBe('kids-playlist');
      expect(cron.action).toBe('sync-playlists');
      const playlists = cron.arguments as Playlist[];
      expect(playlists[0].access_token).toBe(myToken);
      expect(playlists[1].access_token).toBe(otherToken);
    });

    test('Should throw when a secret is missing', () => {
      expect(() => loadCron(env({ OTHER_ACCESS_TOKEN: undefined })))
        .toThrow('Missing secret: OTHER_ACCESS_TOKEN');
    });

    test('Should throw on arguments that are not JSON', () => {
      expect(() => loadCron(env({ [CRON_ARGUMENTS_ENV]: '{nope' })))
        .toThrow('CRON_ARGUMENTS is not valid JSON');
      expect(() => loadCron(env({ [CRON_ARGUMENTS_ENV]: undefined })))
        .toThrow('CRON_ARGUMENTS is not valid JSON');
    });

    test('Should keep the parse error as the cause', () => {
      expect.assertions(1);
      try {
        loadCron(env({ [CRON_ARGUMENTS_ENV]: '{nope' }));
      } catch (e) {
        expect((e as Error).cause).toBeInstanceOf(SyntaxError);
      }
    });
  });

  describe('parseCron', () => {
    test('Should accept each action', () => {
      expect(parseCron('kids', 'sync-playlists', syncArguments).action).toBe('sync-playlists');
      expect(parseCron('car', 'last-tracks', lastTracksArguments).action).toBe('last-tracks');
      expect(parseCron('dedup', 'remove-duplicates', playlistArguments).action).toBe('remove-duplicates');
    });

    test('Should reject a missing name', () => {
      expect(() => parseCron(undefined, 'sync-playlists', syncArguments)).toThrow('CRON_NAME is not set');
      expect(() => parseCron('  ', 'sync-playlists', syncArguments)).toThrow('CRON_NAME is not set');
    });

    test('Should reject an unknown action', () => {
      expect(() => parseCron('kids', 'drop-everything', syncArguments))
        .toThrow('CRON_ACTION must be one of');
    });

    test('Should reject a literal token', () => {
      // The workflows are public: a committed token has to fail loudly
      expect(() => parseCron('dedup', 'remove-duplicates', { access_token: myToken, playlistId: 1 }))
        .toThrow('placeholder such as "$MY_ACCESS_TOKEN"');
      expect(() => parseCron('dedup', 'remove-duplicates', { access_token: '$lowercase', playlistId: 1 }))
        .toThrow('placeholder such as "$MY_ACCESS_TOKEN"');
    });

    test('Should never leak a token in an error message', () => {
      expect.assertions(1);
      try {
        parseCron('dedup', 'remove-duplicates', { access_token: myToken, playlistId: 1 });
      } catch (e) {
        expect((e as Error).message).not.toContain(myToken);
      }
    });

    test('Should reject an incomplete playlist', () => {
      expect(() => parseCron('dedup', 'remove-duplicates', { access_token: '$MY_ACCESS_TOKEN' }))
        .toThrow('needs an "access_token"');
      expect(() => parseCron('dedup', 'remove-duplicates', { access_token: '$MY_ACCESS_TOKEN', playlistId: '1' }))
        .toThrow('needs an "access_token"');
    });

    test('Should reject sync-playlists without two playlists', () => {
      expect(() => parseCron('kids', 'sync-playlists', [syncArguments[0]]))
        .toThrow('at least two playlists');
    });

    test('Should reject last-tracks without source playlists', () => {
      const { playlists, ...withoutPlaylists } = lastTracksArguments;
      expect(playlists).toBeDefined();
      expect(() => parseCron('car', 'last-tracks', withoutPlaylists))
        .toThrow('"playlists" array of at least one playlist');
    });

    test('Should reject invalid last-tracks options', () => {
      expect(() => parseCron('car', 'last-tracks', { ...lastTracksArguments, nbTracks: '10' }))
        .toThrow('"nbTracks" must be a number');
      expect(() => parseCron('car', 'last-tracks', { ...lastTracksArguments, noExplicitLyrics: 'yes' }))
        .toThrow('"noExplicitLyrics" must be a boolean');
    });
  });

  describe('resolveTokens', () => {
    test('Should fill in every placeholder, at any depth', () => {
      const cron = parseCron('car', 'last-tracks', lastTracksArguments);
      const resolved = resolveTokens(cron, secrets);
      const cronArguments = resolved.arguments as Playlist & { playlists: Playlist[], nbTracks: number };

      expect(cronArguments.access_token).toBe(myToken);
      expect(cronArguments.playlists[0].access_token).toBe(otherToken);
      expect(cronArguments.nbTracks).toBe(10);
    });

    test('Should name every missing secret at once, and only the names', () => {
      const cron = parseCron('car', 'last-tracks', lastTracksArguments);

      expect(() => resolveTokens(cron, {}))
        .toThrow('Missing secret: MY_ACCESS_TOKEN, OTHER_ACCESS_TOKEN');
    });

    test('Should leave the cron untouched', () => {
      const cron = parseCron('kids', 'sync-playlists', syncArguments) as Cron;
      resolveTokens(cron, secrets);

      expect(syncArguments[0].access_token).toBe('$MY_ACCESS_TOKEN');
    });
  });
});
