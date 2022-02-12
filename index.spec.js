jest.mock('./config/crons.conf');

const mockLastFavTracks = jest.fn();
jest.mock('./cron-scripts/last-tracks', () => ({
	lastFavTracks: mockLastFavTracks,
}));

const mockSyncPlaylists = jest.fn();
jest.mock('./cron-scripts/sync-playlists', () => ({
	syncPlaylists: mockSyncPlaylists,
}));

describe('Cron index', () => {
	afterEach(() => {
		mockLastFavTracks.mockClear();
		mockSyncPlaylists.mockClear();
	});

	test('Should run cron during 24 hour', async () => {
		jest.useFakeTimers('modern');
		const index = require('./index');
		expect(index).toBeDefined();
		jest.advanceTimersByTime(24 * 60 * 60 * 1000);
		expect(mockLastFavTracks).toBeCalledTimes(2);
		expect(mockSyncPlaylists).toBeCalledTimes(25);
	});
});
