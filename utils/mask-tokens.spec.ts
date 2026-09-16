import maskTokens, { collectTokens } from './mask-tokens';
import { Crons } from './crons-conf';

const FIXTURE = '__mocks__/crons.conf.json';

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const secrets = {
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
};

const resolved = [
  {
    name: 'kids-playlist',
    action: 'sync-playlists',
    arguments: [
      { access_token: myToken, playlistId: 1234567890 },
      { access_token: otherToken, playlistId: 9876543210 },
    ],
  },
  {
    name: 'car-playlist',
    action: 'last-tracks',
    arguments: {
      access_token: myToken,
      playlistId: 1234567890,
      playlists: [{ access_token: otherToken, playlistId: 9876543210 }],
    },
  },
] as unknown as Crons;

describe('Mask tokens', () => {
  test('Should collect the tokens of every cron, nested ones included', () => {
    expect(collectTokens(resolved)).toEqual([myToken, otherToken]);
  });

  test('Should collect each token once', () => {
    // myToken appears four times across the two crons
    expect(collectTokens(resolved).filter((token) => token === myToken)).toHaveLength(1);
  });

  test('Should collect nothing from an empty configuration', () => {
    expect(collectTokens([])).toEqual([]);
  });

  test('Should build one masking command per token', () => {
    expect(maskTokens(secrets, FIXTURE)).toEqual([
      `::add-mask::${myToken}`,
      `::add-mask::${otherToken}`,
    ]);
  });

  test('Should mask the resolved tokens, never the placeholders', () => {
    expect(maskTokens(secrets, FIXTURE).join('\n')).not.toContain('$MY_ACCESS_TOKEN');
  });
});
