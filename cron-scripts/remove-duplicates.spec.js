const { removeDuplicates } = require('./remove-duplicates');

// MOCKS
const {
	cleanAll,
	nockGetPlaylistIdTracks,
	nockDeletePlaylistIdTracks,
	nockRespondError,
	nockThrowError,
} = require('../mocks/nocks');

const mockEntityDeezerTracks = require('../mocks/api-deezer-tracks');

const cronArguments = { access_token: 'BLUBLU', playlistId: 1234567890};

describe('Sync Playlists Cron', () => {
	afterEach(() => {
		cleanAll();
	});

	test('removeDuplicates should be defined', () => {
		expect(removeDuplicates).toBeDefined();
	});

	test('Should throw without parameters', async () => {
		try {
			await removeDuplicates();
		} catch (err) {
			expect(err.message).toEqual(
				expect.stringContaining('Cannot destructure property'),
			);
		}
	});

	test('Should return if api respond an error', async () => {
		const mockRespondError = nockRespondError(/\/playlist\/\d+\/tracks/);
		const cron = await removeDuplicates(cronArguments);

		expect(cron).toBeUndefined();
		expect(mockRespondError.isDone()).toBeTruthy();
	});

	test('Should return if api throw an error', async () => {
		const mockRespondError = nockThrowError(/\/playlist\/\d+\/tracks/);
		const cron = await removeDuplicates(cronArguments);

		expect(cron).toBeUndefined();
		expect(mockRespondError.isDone()).toBeTruthy();
	});

	test('Should not delete track', async () => {
		const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(1);
		const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();

		await removeDuplicates(cronArguments);

		expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
		expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
	});

	test('Should delete track', async () => {
		const playlistWithDuplicateTrack = JSON.parse(
			JSON.stringify(mockEntityDeezerTracks),
		);
		playlistWithDuplicateTrack.data.push({
			'id': 10,
			'title_short': '9',
			'artist': {
				'id': 9
			},
			'album': {
				'id': 10
			},
			'duration': 9,
			'readable': true,
			'explicit_lyrics': false,
			'time_add': 10
		});
		const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(1, playlistWithDuplicateTrack);
		const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();

		await removeDuplicates(cronArguments);

		expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
		expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
	});


});