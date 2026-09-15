import maskTokens, { collectTokens } from './mask-tokens';
import { CRONS_CONF_ENV, Crons } from './crons-conf';

const accessToken = 'frblublublublublublublublublublublublublublublublu';
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';

const conf = [
  {
    name: 'kids-playlist',
    refreshInterval: '0 * * * *',
    action: 'sync-playlists',
    arguments: [
      { access_token: accessToken, playlistId: 1234567890 },
      { access_token: otherAccessToken, playlistId: 9876543210 },
    ],
  },
  {
    name: 'car-playlist',
    refreshInterval: '0 0 * * *',
    action: 'last-tracks',
    arguments: {
      access_token: accessToken,
      playlistId: 1234567890,
      playlists: [{ access_token: otherAccessToken, playlistId: 9876543210 }],
    },
  },
];

describe('Mask tokens', () => {
  test('Should collect the tokens of every cron, nested ones included', () => {
    const tokens = collectTokens(conf as Crons);

    expect(tokens).toEqual([accessToken, otherAccessToken]);
  });

  test('Should collect nothing from an empty configuration', () => {
    expect(collectTokens([])).toEqual([]);
  });

  test('Should build one masking command per token', () => {
    expect(maskTokens({ [CRONS_CONF_ENV]: JSON.stringify(conf) })).toEqual([
      `::add-mask::${accessToken}`,
      `::add-mask::${otherAccessToken}`,
    ]);
  });
});
