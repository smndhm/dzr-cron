import lastTracks from './cron-scripts/last-tracks';
import syncPlaylist from './cron-scripts/sync-playlists';
import removeDuplicates from './cron-scripts/remove-duplicates';

jest.mock('./cron-scripts/last-tracks');
jest.mock('./cron-scripts/sync-playlists');
jest.mock('./cron-scripts/remove-duplicates');
jest.mock('./crons.conf');

const mocklastTracks = jest.mocked(lastTracks);
const mockSyncPlaylists = jest.mocked(syncPlaylist);
const mockRemoveDuplicates = jest.mocked(removeDuplicates);

describe('Cron index', () => {
  afterEach(() => {
    mocklastTracks.mockClear();
    mockSyncPlaylists.mockClear();
    mockRemoveDuplicates.mockClear();
  });

  test('Should run cron during 24 hour', async () => {
    jest.useFakeTimers('modern');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const index = require('./index');
    expect(index).toBeDefined();
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    // One extra on count because crons runs on launch 
    expect(mocklastTracks).toBeCalledTimes(2);
    expect(mockSyncPlaylists).toBeCalledTimes(25);
    expect(mockRemoveDuplicates).toBeCalledTimes(2);
  });
});
