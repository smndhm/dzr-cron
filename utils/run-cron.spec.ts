import runCron from './run-cron';
import { Crons } from './crons-conf';
import lastTracks from '../cron-scripts/last-tracks';
import syncPlaylists from '../cron-scripts/sync-playlists';
import removeDuplicates from '../cron-scripts/remove-duplicates';

jest.mock('../cron-scripts/last-tracks');
jest.mock('../cron-scripts/sync-playlists');
jest.mock('../cron-scripts/remove-duplicates');

const mockLastTracks = jest.mocked(lastTracks);
const mockSyncPlaylists = jest.mocked(syncPlaylists);
const mockRemoveDuplicates = jest.mocked(removeDuplicates);

const playlist = { access_token: 'access_token', playlistId: 1234567890 };
const otherPlaylist = { access_token: 'access_token', playlistId: 9876543210 };

describe('Run cron', () => {
  test('Should run the last-tracks script', async () => {
    const cronArguments = { ...playlist, playlists: [otherPlaylist] };
    await runCron({
      refreshInterval: '0 * * * *',
      action: 'last-tracks',
      arguments: cronArguments,
    } as Crons[number]);

    expect(mockLastTracks).toBeCalledWith(cronArguments);
    expect(mockSyncPlaylists).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
  });

  test('Should run the sync-playlists script', async () => {
    const cronArguments = [playlist, otherPlaylist];
    await runCron({
      refreshInterval: '0 * * * *',
      action: 'sync-playlists',
      arguments: cronArguments,
    } as Crons[number]);

    expect(mockSyncPlaylists).toBeCalledWith(cronArguments);
    expect(mockLastTracks).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
  });

  test('Should run the remove-duplicates script', async () => {
    await runCron({
      refreshInterval: '0 0 * * *',
      action: 'remove-duplicates',
      arguments: playlist,
    } as Crons[number]);

    expect(mockRemoveDuplicates).toBeCalledWith(playlist);
    expect(mockLastTracks).not.toBeCalled();
    expect(mockSyncPlaylists).not.toBeCalled();
  });

  test('Should ignore an unknown action', async () => {
    await runCron({ refreshInterval: '0 * * * *', action: 'nope' } as unknown as Crons[number]);

    expect(mockLastTracks).not.toBeCalled();
    expect(mockSyncPlaylists).not.toBeCalled();
    expect(mockRemoveDuplicates).not.toBeCalled();
  });
});
