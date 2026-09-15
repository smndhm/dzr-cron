import runOnce, { WINDOW_MINUTES_ENV, RUN_ALL_ENV } from './run-once';
import { CRONS_CONF_ENV } from './utils/crons-conf';
import setLogger from './utils/logger';
import lastTracks from './cron-scripts/last-tracks';
import syncPlaylists from './cron-scripts/sync-playlists';
import removeDuplicates from './cron-scripts/remove-duplicates';

jest.mock('./cron-scripts/last-tracks');
jest.mock('./cron-scripts/sync-playlists');
jest.mock('./cron-scripts/remove-duplicates');

const mockLastTracks = jest.mocked(lastTracks);
const mockSyncPlaylists = jest.mocked(syncPlaylists);
const mockRemoveDuplicates = jest.mocked(removeDuplicates);

const accessToken = 'frblublublublublublublublublublublublublublublublu';
const playlist = { access_token: accessToken, playlistId: 1234567890 };

const conf = [
  {
    refreshInterval: '0 * * * *',
    action: 'sync-playlists',
    arguments: [playlist, { access_token: accessToken, playlistId: 9876543210 }],
  },
  {
    refreshInterval: '0 0 * * *',
    action: 'remove-duplicates',
    arguments: playlist,
  },
];

const env = (overrides: NodeJS.ProcessEnv = {}) => ({
  [CRONS_CONF_ENV]: JSON.stringify(conf),
  ...overrides,
});

describe('Run once', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    // 2022-03-15T10:17 in Europe/Paris
    jest.setSystemTime(new Date('2022-03-15T09:17:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Should only run the crons due since the last run', async () => {
    const errors = await runOnce(env());

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockSyncPlaylists).toBeCalledWith(conf[0].arguments);
    expect(mockRemoveDuplicates).not.toBeCalled();
    expect(mockLastTracks).not.toBeCalled();
    expect(errors).toBe(0);
  });

  test('Should run the daily cron once the day changed', async () => {
    // 2022-03-16T00:17 in Europe/Paris
    jest.setSystemTime(new Date('2022-03-15T23:17:00Z'));

    await runOnce(env());

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should run every cron when asked to', async () => {
    await runOnce(env({ [RUN_ALL_ENV]: 'true' }));

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should widen the window on demand', async () => {
    await runOnce(env({ [WINDOW_MINUTES_ENV]: `${24 * 60}` }));

    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should report the errors logged by the scripts', async () => {
    mockSyncPlaylists.mockImplementation(async () => {
      setLogger('sync-playlists').error('API Error Response');
    });

    const errors = await runOnce(env());

    expect(errors).toBe(1);
  });

  test('Should not fail when nothing is configured', async () => {
    const errors = await runOnce({ [CRONS_CONF_ENV]: '[]' });

    expect(errors).toBe(0);
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject an invalid window', async () => {
    await expect(runOnce(env({ [WINDOW_MINUTES_ENV]: 'soon' })))
      .rejects.toThrow(WINDOW_MINUTES_ENV);
    await expect(runOnce(env({ [WINDOW_MINUTES_ENV]: '0' })))
      .rejects.toThrow(WINDOW_MINUTES_ENV);
  });

  test('Should reject an invalid configuration', async () => {
    await expect(runOnce({ [CRONS_CONF_ENV]: '{nope' })).rejects.toThrow('not valid JSON');
    expect(mockSyncPlaylists).not.toBeCalled();
  });
});
