const { syncPlaylists } = require('./sync-playlists');

// MOCK
const {
	nockGetPlaylistIdTracks,
	nockPostPlaylistIdTracks,
	cleanAll,
	nockThrowError,
	nockRespondError,
} = require('../mocks/nocks');

const mockEntityDeezerTracks = require('../mocks/api-deezer-tracks');

const cronArguments = [
	{ access_token: 'BLUBLU', playlistId: 1234567890 },
	{ access_token: 'BLUBLU', playlistId: 1234567890 },
];

describe('Sync Playlists Cron', () => {
	afterEach(() => {
		cleanAll();
	});

	test('syncPlaylists should be defined', () => {
		expect(syncPlaylists).toBeDefined();
	});

	test('Should throw without parameters', async () => {
		try {
			await syncPlaylists();
		} catch (err) {
			expect(err.message).toEqual(
				expect.stringContaining('Cannot destructure property'),
			);
		}
	});

	test('Should return if argument is not an array', async () => {
		const cron = await syncPlaylists({});
		expect(cron).toBeUndefined();
	});

	test('Should return if array length is under 2', async () => {
		const cron = await syncPlaylists([
			{ access_token: 'BLUBLU', playlistId: 1234567890 },
		]);
		expect(cron).toBeUndefined();
	});

	test('Should return if array objects are missing mendatory parameters', async () => {
		const cron = await syncPlaylists([{}, {}]);
		expect(cron).toBeUndefined();
	});

	test('Should not update playlist when they are the same', async () => {
		const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(
			cronArguments.length,
		);
		const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

		await syncPlaylists(cronArguments);

		expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
		expect(mockPostPlaylistIdTracks.isDone()).toBeFalsy();
	});

	test('Should update one playlist when one of them has a new track', async () => {
		const playlistWithNewTrack = JSON.parse(
			JSON.stringify(mockEntityDeezerTracks),
		);
		playlistWithNewTrack.data.push({
			id: 10,
			readable: true,
			explicit_lyrics: false,
			time_add: 10,
		});
		const mockGetPlaylistIdTracks_1 = nockGetPlaylistIdTracks();
		const mockGetPlaylistIdTracks_2 = nockGetPlaylistIdTracks(
			null,
			playlistWithNewTrack,
		);
		const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks(2);

		await syncPlaylists(cronArguments);

		expect(mockGetPlaylistIdTracks_1.isDone()).toBeTruthy();
		expect(mockGetPlaylistIdTracks_2.isDone()).toBeTruthy();
		expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
	});

	test('Should throw on api error response', async () => {
		const mockRespondError = nockThrowError(/\/playlist\/\d+\/tracks/);

		const cron = await syncPlaylists(cronArguments);

		expect(cron).toBeUndefined();
		expect(mockRespondError.isDone()).toBeTruthy();
	});

	test('Should return if not enought playlists are available', async () => {
		const mockRespondError = nockRespondError(
			/\/playlist\/\d+\/tracks/,
			cronArguments.length,
		);

		const cron = await syncPlaylists(cronArguments);

		expect(cron).toBeUndefined();
		expect(mockRespondError.isDone()).toBeTruthy();
	});
});
