jest.mock('./config/crons.conf');

const mocklastTracks = jest.fn();
jest.mock('./cron-scripts/last-tracks', () => ({
	lastTracks: mocklastTracks,
}));

const mockSyncPlaylists = jest.fn();
jest.mock('./cron-scripts/sync-playlists', () => ({
	syncPlaylists: mockSyncPlaylists,
}));

const mockRemoveDuplicates = jest.fn();
jest.mock('./cron-scripts/remove-duplicates', () => ({
	removeDuplicates: mockRemoveDuplicates,
}));

describe('Cron index', () => {
	afterEach(() => {
		mocklastTracks.mockClear();
		mockSyncPlaylists.mockClear();
		mockRemoveDuplicates.mockClear();
	});

	test('Should run cron during 24 hour', async () => {
		jest.useFakeTimers('modern');
		const index = require('./index');
		expect(index).toBeDefined();
		jest.advanceTimersByTime(24 * 60 * 60 * 1000);
		expect(mocklastTracks).toBeCalledTimes(2);
		expect(mockSyncPlaylists).toBeCalledTimes(25);
		expect(mockRemoveDuplicates).toBeCalledTimes(2);
	});
});
