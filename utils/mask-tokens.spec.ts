import maskTokens, { collectTokens } from './mask-tokens';
import { CRON_NAME_ENV, CRON_ACTION_ENV, CRON_ARGUMENTS_ENV, Cron } from './cron-conf';

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const resolved = {
  name: 'car-playlist',
  action: 'last-tracks',
  arguments: {
    access_token: myToken,
    playlistId: 1234567890,
    playlists: [
      { access_token: otherToken, playlistId: 9876543210 },
      { access_token: myToken, playlistId: 1111111111 },
    ],
  },
} as unknown as Cron;

const env = {
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
  [CRON_NAME_ENV]: 'kids-playlist',
  [CRON_ACTION_ENV]: 'sync-playlists',
  [CRON_ARGUMENTS_ENV]: JSON.stringify([
    { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 },
    { access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 },
  ]),
};

describe('Mask tokens', () => {
  test('Should collect the tokens of a cron, nested ones included', () => {
    expect(collectTokens(resolved)).toEqual([myToken, otherToken]);
  });

  test('Should collect each token once', () => {
    // myToken appears three times in the cron above
    expect(collectTokens(resolved).filter((token) => token === myToken)).toHaveLength(1);
  });

  test('Should build one masking command per token', () => {
    expect(maskTokens(env)).toEqual([
      `::add-mask::${myToken}`,
      `::add-mask::${otherToken}`,
    ]);
  });

  test('Should mask the resolved tokens, never the placeholders', () => {
    expect(maskTokens(env).join('\n')).not.toContain('$MY_ACCESS_TOKEN');
  });
});
