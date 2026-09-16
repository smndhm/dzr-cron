import runOnce, { CRON_NAMES_ENV } from './run-once';
import { CRONS_CONF_ENV } from './utils/crons-conf';
import setLogger from './utils/logger';
import lastTracks from './cron-scripts/last-tracks';
import syncPlaylists from './cron-scripts/sync-playlists';
import removeDuplicates from './cron-scripts/remove-duplicates';

vi.mock('./cron-scripts/last-tracks');
vi.mock('./cron-scripts/sync-playlists');
vi.mock('./cron-scripts/remove-duplicates');

const mockLastTracks = vi.mocked(lastTracks);
const mockSyncPlaylists = vi.mocked(syncPlaylists);
const mockRemoveDuplicates = vi.mocked(removeDuplicates);

const accessToken = 'frblublublublublublublublublublublublublublublublu';
const playlist = { access_token: accessToken, playlistId: 1234567890 };
const otherPlaylist = { access_token: accessToken, playlistId: 9876543210 };

const conf = [
  {
    name: 'kids-playlist',
    action: 'sync-playlists',
    arguments: [playlist, otherPlaylist],
  },
  {
    name: 'car-playlist',
    action: 'last-tracks',
    arguments: { ...playlist, playlists: [otherPlaylist] },
  },
  {
    name: 'remove-duplicates',
    action: 'remove-duplicates',
    arguments: playlist,
  },
];

const env = (names?: string) => ({
  [CRONS_CONF_ENV]: JSON.stringify(conf),
  ...(names === undefined ? {} : { [CRON_NAMES_ENV]: names }),
});

describe('Run once', () => {
  test('Should only run the named cron', async () => {
    const errors = await runOnce(env('kids-playlist'));

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockSyncPlaylists).toBeCalledWith(conf[0].arguments);
    expect(mockLastTracks).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
    expect(errors).toBe(0);
  });

  test('Should run every named cron', async () => {
    await runOnce(env('car-playlist,remove-duplicates'));

    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should ignore the spacing between the names', async () => {
    await runOnce(env(' car-playlist ,  remove-duplicates '));

    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should run every cron when no name is given', async () => {
    await runOnce(env());

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should reject an unknown name rather than run nothing', async () => {
    // A workflow and the configuration disagreeing must not look like a healthy run
    await expect(runOnce(env('kid-playlist'))).rejects.toThrow('Unknown cron name: kid-playlist');
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should report the errors logged by the scripts', async () => {
    mockSyncPlaylists.mockImplementation(async () => {
      setLogger('sync-playlists').error('API Error Response');
    });

    const errors = await runOnce(env('kids-playlist'));

    expect(errors).toBe(1);
  });

  test('Should not fail when nothing is configured', async () => {
    const errors = await runOnce({ [CRONS_CONF_ENV]: '[]' });

    expect(errors).toBe(0);
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject an invalid configuration', async () => {
    await expect(runOnce({ [CRONS_CONF_ENV]: '{nope' })).rejects.toThrow('not valid JSON');
    expect(mockSyncPlaylists).not.toBeCalled();
  });
});
