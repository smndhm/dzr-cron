import loadCrons, {
  parseCrons,
  resolveTokens,
  selectCrons,
  CRONS_CONF_FILE,
  Crons,
} from './crons-conf';

const FIXTURE = '__mocks__/crons.conf.json';

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const secrets = {
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
};

const validConf = [
  {
    name: 'kids-playlist',
    action: 'sync-playlists',
    arguments: [
      { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 },
      { access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 },
    ],
  },
  {
    name: 'remove-duplicates',
    action: 'remove-duplicates',
    arguments: { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 },
  },
  {
    name: 'car-playlist',
    action: 'last-tracks',
    arguments: {
      access_token: '$MY_ACCESS_TOKEN',
      playlistId: 1234567890,
      playlists: [{ access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 }],
      nbTracks: 10,
      noExplicitLyrics: true,
    },
  },
];

describe('Crons configuration', () => {
  describe('loadCrons', () => {
    test('Should read the versioned file and fill in the tokens', () => {
      const crons = loadCrons(secrets, FIXTURE);

      expect(crons.map(({ name }) => name))
        .toEqual(['kids-playlist', 'car-playlist', 'remove-duplicates']);
      expect(crons[0].arguments[0].access_token).toBe(myToken);
      expect(crons[0].arguments[1].access_token).toBe(otherToken);
    });

    test('Should default to the versioned configuration of the repository', () => {
      expect(CRONS_CONF_FILE).toBe('crons.conf.json');
      expect(() => loadCrons({}, 'nope.json')).toThrow('nope.json is missing or is not valid JSON');
    });

    test('Should throw when a secret is missing', () => {
      expect(() => loadCrons({ MY_ACCESS_TOKEN: myToken }, FIXTURE))
        .toThrow('Missing secret: OTHER_ACCESS_TOKEN');
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

    test('Should reject a literal token', () => {
      // The file is public: a committed token has to fail loudly
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: myToken, playlistId: 1 } }]))
        .toThrow('placeholder such as "$MY_ACCESS_TOKEN"');
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: '$lowercase', playlistId: 1 } }]))
        .toThrow('placeholder such as "$MY_ACCESS_TOKEN"');
    });

    test('Should never leak a token in an error message', () => {
      expect.assertions(1);
      try {
        parseCrons([{ ...validConf[1], arguments: { access_token: myToken, playlistId: 1 } }]);
      } catch (e) {
        expect((e as Error).message).not.toContain(myToken);
      }
    });

    test('Should reject a cron without a name', () => {
      expect(() => parseCrons([{ ...validConf[1], name: undefined }])).toThrow('missing "name"');
      expect(() => parseCrons([{ ...validConf[1], name: '  ' }])).toThrow('missing "name"');
    });

    test('Should reject duplicated names', () => {
      expect(() => parseCrons([validConf[1], { ...validConf[0], name: validConf[1].name }]))
        .toThrow('duplicated name "remove-duplicates"');
    });

    test('Should reject an unknown action', () => {
      expect(() => parseCrons([{ ...validConf[1], action: 'drop-everything' }]))
        .toThrow('"action" must be one of');
    });

    test('Should reject an incomplete playlist', () => {
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: '$MY_ACCESS_TOKEN' } }]))
        .toThrow('"arguments" needs an "access_token"');
      expect(() => parseCrons([{ ...validConf[1], arguments: { access_token: '$MY_ACCESS_TOKEN', playlistId: '1' } }]))
        .toThrow('"arguments" needs an "access_token"');
    });

    test('Should reject sync-playlists without two playlists', () => {
      expect(() => parseCrons([{ ...validConf[0], arguments: [validConf[0].arguments[0]] }]))
        .toThrow('at least two playlists');
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
  });

  describe('resolveTokens', () => {
    test('Should fill in every placeholder, at any depth', () => {
      const [, , carPlaylist] = resolveTokens(validConf as unknown as Crons, secrets);
      const cronArguments = carPlaylist.arguments as Record<string, never>;

      expect(cronArguments.access_token).toBe(myToken);
      expect(cronArguments.playlists[0].access_token).toBe(otherToken);
      expect(cronArguments.nbTracks).toBe(10);
    });

    test('Should name every missing secret at once, and only the names', () => {
      expect(() => resolveTokens(validConf as unknown as Crons, {}))
        .toThrow('Missing secret: MY_ACCESS_TOKEN, OTHER_ACCESS_TOKEN');
    });

    test('Should leave the configuration untouched', () => {
      resolveTokens(validConf as unknown as Crons, secrets);

      expect(validConf[1].arguments).toEqual({ access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 });
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
