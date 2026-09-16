import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import runOnce from './run-once';
import { CRON_NAME_ENV, CRON_ACTION_ENV, CRON_ARGUMENTS_ENV } from './utils/cron-conf';
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

const myToken = 'frblublublublublublublublublublublublublublublublu';
const otherToken = 'frblablablablablablablablablablablablablablablabla';

const syncArguments = [
  { access_token: '$MY_ACCESS_TOKEN', playlistId: 1234567890 },
  { access_token: '$OTHER_ACCESS_TOKEN', playlistId: 9876543210 },
];

const env = (overrides: NodeJS.ProcessEnv = {}) => ({
  MY_ACCESS_TOKEN: myToken,
  OTHER_ACCESS_TOKEN: otherToken,
  [CRON_NAME_ENV]: 'kids-playlist',
  [CRON_ACTION_ENV]: 'sync-playlists',
  [CRON_ARGUMENTS_ENV]: JSON.stringify(syncArguments),
  ...overrides,
});

describe('Run once', () => {
  test('Should run the cron the workflow defined, with its tokens filled in', async () => {
    const errors = await runOnce(env());

    expect(mockSyncPlaylists).toBeCalledTimes(1);
    expect(mockSyncPlaylists).toBeCalledWith([
      { access_token: myToken, playlistId: 1234567890 },
      { access_token: otherToken, playlistId: 9876543210 },
    ]);
    expect(mockLastTracks).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
    expect(errors).toBe(0);
  });

  test('Should name the cron in the logs', async () => {
    const lines: string[] = [];
    await runOnce(env(), (line) => lines.push(line));

    expect(lines.join('\n')).toContain('"action":"cron-started","cron":"kids-playlist"');
    expect(lines.join('\n')).toContain('"action":"cron-ended","cron":"kids-playlist","errors":0');
  });

  test('Should write the summary GitHub shows on the run page', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'run-once-')), 'summary.md');

    await runOnce({ ...env(), GITHUB_STEP_SUMMARY: file });

    expect(readFileSync(file, 'utf8')).toContain('## kids-playlist');
  });

  test('Should report the errors logged by the script', async () => {
    mockSyncPlaylists.mockImplementation(async () => {
      setLogger('sync-playlists').error('API Error Response');
    });

    expect(await runOnce(env())).toBe(1);
  });

  test('Should catch a script that throws, and stay red', async () => {
    mockSyncPlaylists.mockRejectedValue(new Error('Deezer answered 403 Forbidden.'));

    expect(await runOnce(env())).toBe(1);
  });

  test('Should reject a missing secret before calling Deezer', async () => {
    await expect(runOnce(env({ OTHER_ACCESS_TOKEN: undefined })))
      .rejects.toThrow('Missing secret: OTHER_ACCESS_TOKEN');
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject an unknown action', async () => {
    await expect(runOnce(env({ [CRON_ACTION_ENV]: 'drop-everything' })))
      .rejects.toThrow('CRON_ACTION must be one of');
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should reject arguments that are not JSON', async () => {
    await expect(runOnce(env({ [CRON_ARGUMENTS_ENV]: '{nope' })))
      .rejects.toThrow('CRON_ARGUMENTS is not valid JSON');
    expect(mockSyncPlaylists).not.toBeCalled();
  });
});
