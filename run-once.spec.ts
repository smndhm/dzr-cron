import runOnce, { CRON_NAMES_ENV } from './run-once';
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

const FIXTURE = '__mocks__/crons.conf.json';
const EMPTY_FIXTURE = '__mocks__/crons.conf.empty.json';

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const env = (names?: string) => ({
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
  ...(names === undefined ? {} : { [CRON_NAMES_ENV]: names }),
});

describe('Run once', () => {
  test('Should only run the named cron', async () => {
    const errors = await runOnce(env('kids-playlist'), FIXTURE);

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockLastTracks).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
    expect(errors).toBe(0);
  });

  test('Should hand the script its resolved tokens', async () => {
    await runOnce(env('kids-playlist'), FIXTURE);

    expect(mockSyncPlaylists).toBeCalledWith([
      { access_token: myToken, playlistId: 1234567890 },
      { access_token: otherToken, playlistId: 9876543210 },
    ]);
  });

  test('Should run every named cron', async () => {
    await runOnce(env('car-playlist,remove-duplicates'), FIXTURE);

    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should ignore the spacing between the names', async () => {
    await runOnce(env(' car-playlist ,  remove-duplicates '), FIXTURE);

    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should run every cron when no name is given', async () => {
    await runOnce(env(), FIXTURE);

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
  });

  test('Should name each cron before it runs', async () => {
    // Two crons can share a script, so the log has to say which one is speaking
    const lines: string[] = [];
    await runOnce(env('car-playlist,remove-duplicates'), FIXTURE, (line) => lines.push(line));

    expect(lines.join('\n')).toContain('"action":"cron-started","cron":"car-playlist"');
    expect(lines.join('\n')).toContain('"action":"cron-started","cron":"remove-duplicates"');
  });

  test('Should let the other crons run when one fails', async () => {
    mockLastTracks.mockRejectedValue(new Error('Deezer answered 403 Forbidden.'));

    const errors = await runOnce(env('car-playlist,remove-duplicates'), FIXTURE);

    // car-playlist threw, remove-duplicates still ran, and the run is red
    expect(mockLastTracks).toBeCalledTimes(1);
    expect(mockRemoveDuplicates).toBeCalledTimes(1);
    expect(errors).toBe(1);
  });

  test('Should reject an unknown name rather than run nothing', async () => {
    await expect(runOnce(env('kid-playlist'), FIXTURE))
      .rejects.toThrow('Unknown cron name: kid-playlist');
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject a missing secret before calling Deezer', async () => {
    await expect(runOnce({ MY_ACCESS_TOKEN: myToken }, FIXTURE))
      .rejects.toThrow('Missing secret: OTHER_ACCESS_TOKEN');
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should report the errors logged by the scripts', async () => {
    mockSyncPlaylists.mockImplementation(async () => {
      setLogger('sync-playlists').error('API Error Response');
    });

    const errors = await runOnce(env('kids-playlist'), FIXTURE);

    expect(errors).toBe(1);
  });

  test('Should not fail when nothing is configured', async () => {
    const errors = await runOnce(env(), EMPTY_FIXTURE);

    expect(errors).toBe(0);
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject a missing configuration file', async () => {
    await expect(runOnce(env(), 'nope.json')).rejects.toThrow('nope.json is missing');
  });
});
