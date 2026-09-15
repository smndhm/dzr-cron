import loadCrons, { parseCrons, selectCrons, CRONS_CONF_ENV, Crons } from './crons-conf';

jest.mock('../crons.conf');

const accessToken = 'frblublublublublublublublublublublublublublublublu';

const validConf = [
  {
    name: 'kids-playlist',
    refreshInterval: '0 * * * *',
    action: 'sync-playlists',
    arguments: [
      { access_token: accessToken, playlistId: 1234567890 },
      { access_token: accessToken, playlistId: 9876543210 },
    ],
  },
  {
    name: 'remove-duplicates',
    refreshInterval: '0 0 * * *',
    action: 'remove-duplicates',
    arguments: { access_token: accessToken, playlistId: 1234567890 },
  },
  {
    name: 'car-playlist',
    action: 'last-tracks',
    arguments: {
      access_token: accessToken,
      playlistId: 1234567890,
      playlists: [{ access_token: accessToken, playlistId: 9876543210 }],
      nbTracks: 10,
      noExplicitLyrics: true,
    },
  },
];

describe('Crons configuration', () => {
  describe('loadCrons', () => {
    test('Should fall back on the configuration file', () => {
      expect(loadCrons({})).toHaveLength(3);
      expect(loadCrons({ [CRONS_CONF_ENV]: '   ' })).toHaveLength(3);
    });

    test('Should read the configuration from the environment', () => {
      const crons = loadCrons({ [CRONS_CONF_ENV]: JSON.stringify(validConf) });
      expect(crons).toHaveLength(3);
      expect(crons[0].action).toBe('sync-playlists');
    });

    test('Should throw on invalid JSON', () => {
      expect(() => loadCrons({ [CRONS_CONF_ENV]: '{nope' })).toThrow('not valid JSON');
    });
  });

  describe('parseCrons', () => {
    test('Should accept a valid configuration', () => {
      expect(parseCrons(validConf)).toHaveLength(3);
      expect(parseCrons([])).toHaveLength(0);
    });

    test('Should reject anything but an array', () => {
      expect(() => parseCrons({})).toThrow('must be a JSON array');
      expect(() => parseCrons(null)).toThrow('must be a JSON array');
    });

    test('Should reject a cron without a name', () => {
      expect(() => parseCrons([{ ...validConf[1], name: undefined }])).toThrow('missing "name"');
      expect(() => parseCrons([{ ...validConf[1], name: '  ' }])).toThrow('missing "name"');
    });

    test('Should reject duplicated names', () => {
      // The workflows address the crons by name, so they have to be unique
      expect(() => parseCrons([validConf[1], { ...validConf[0], name: validConf[1].name }]))
        .toThrow('duplicated name "remove-duplicates"');
    });

    test('Should accept a cron without refreshInterval', () => {
      // Only `npm run start` needs one, the workflows carry their own schedule
      expect(parseCrons([{ ...validConf[1], refreshInterval: undefined }])).toHaveLength(1);
    });

    test('Should reject an invalid refreshInterval when there is one', () => {
      expect(() => parseCrons([{ ...validConf[1], refreshInterval: 'every hour' }]))
        .toThrow('invalid cron expression');
      expect(() => parseCrons([{ ...validConf[1], refreshInterval: 60 }]))
        .toThrow('"refreshInterval" must be a string');
    });

    test('Should reject an unknown action', () => {
      expect(() => parseCrons([{ ...validConf[1], action: 'drop-everything' }]))
        .toThrow('"action" must be one of');
    });

    test('Should reject an incomplete playlist', () => {
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: accessToken } }]))
        .toThrow('"arguments" needs an "access_token" string');
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: '', playlistId: 1 } }]))
        .toThrow('"arguments" needs an "access_token" string');
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: accessToken, playlistId: '1234567890' } }]))
        .toThrow('"arguments" needs an "access_token" string');
    });

    test('Should reject sync-playlists without two playlists', () => {
      expect(() => parseCrons([{ ...validConf[0], arguments: [validConf[0].arguments[0]] }]))
        .toThrow('at least two playlists');
      expect(() => parseCrons([{ ...validConf[0], arguments: [{ playlistId: 1 }, { playlistId: 2 }] }]))
        .toThrow('every playlist needs an "access_token"');
    });

    test('Should reject last-tracks without source playlists', () => {
      const { playlists, ...withoutPlaylists } = validConf[2].arguments as Record<string, unknown>;
      expect(playlists).toBeDefined();
      expect(() => parseCrons([{ ...validConf[2], arguments: withoutPlaylists }]))
        .toThrow('"playlists" array of at least one playlist');
    });

    test('Should reject invalid last-tracks options', () => {
      expect(() => parseCrons([{ ...validConf[2], arguments: { ...validConf[2].arguments, nbTracks: '10' } }]))
        .toThrow('"nbTracks" must be a number');
      expect(() => parseCrons([{ ...validConf[2], arguments: { ...validConf[2].arguments, noExplicitLyrics: 'yes' } }]))
        .toThrow('"noExplicitLyrics" must be a boolean');
    });

    test('Should never leak an access token in an error message', () => {
      // Errors land in public GitHub Actions logs
      expect.assertions(1);
      try {
        parseCrons([{ ...validConf[1], action: 'nope' }]);
      } catch (e) {
        expect((e as Error).message).not.toContain(accessToken);
      }
    });
  });

  describe('selectCrons', () => {
    const crons = validConf as unknown as Crons;

    test('Should keep the named crons, in the configuration order', () => {
      expect(selectCrons(crons, 'remove-duplicates,kids-playlist').map(({ name }) => name))
        .toEqual(['kids-playlist', 'remove-duplicates']);
    });

    test('Should trim the names', () => {
      expect(selectCrons(crons, ' car-playlist , remove-duplicates ')).toHaveLength(2);
    });

    test('Should keep everything when no name is given', () => {
      expect(selectCrons(crons, '')).toHaveLength(3);
      expect(selectCrons(crons, '  ,  ')).toHaveLength(3);
    });

    test('Should throw on an unknown name', () => {
      expect(() => selectCrons(crons, 'kids-playlist,nope,neither'))
        .toThrow('Unknown cron name: nope, neither');
    });
  });
});
