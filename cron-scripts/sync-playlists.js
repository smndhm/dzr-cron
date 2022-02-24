const logger = require('pino')({
	mixin() {
		return { script: 'cron-sync-playlists' };
	},
	timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
});
const {
	playlistsFilter,
	getPlaylistTracks,
	postPlaylistTracks,
	postPlaylistTracksOrder,
} = require('../common/dzr-utils');

exports.syncPlaylists = async (playlists = []) => {
	if (!Array.isArray(playlists)) {
		logger.error('Wrong configuration for cron arguments');
		return;
	}

	playlists = playlistsFilter(playlists);

	if (playlists.length < 2) {
		logger.error('You must set at least 2 playlists');
		return;
	}

	try {
		logger.info('Script started');

		// GET ALL PLAYLISTS
		const dzrPlaylists = [];
		for await (const { access_token, playlistId } of playlists) {
			const data = await getPlaylistTracks(access_token, playlistId);
			if (!data.error) {
				data.id = playlistId;
				data.access_token = access_token;
				dzrPlaylists.push(data);
			} else {
				logger.error('API Error Response', data.error);
			}
		}

		if (dzrPlaylists.length < 2) {
			logger.error('Not enought valid playlists.');
			return;
		}

		// GET TRACK LIST
		const playlistsTracks = dzrPlaylists
		// GROUP ALL TRACKS
			.reduce((acc, curr) => [...acc, ...curr.data], [])
		// ORDER BY TIME ADD (IF SAME, ORDER BY ID)
			.sort((a, b) =>
				a.time_add - b.time_add !== 0 ? a.time_add - b.time_add : a.id - b.id
			)
		// IF 2 TRACKS ARE THE SAME, KEEP FIRST ADDED
			.reduce((acc, curr) => {
				if (acc.map((track) => track.id).indexOf(curr.id) === -1) {
					acc.push(curr);
				}
				return acc;
			}, [])
		// KEEP IDS
			.map((track) => track.id);

		// UPDATE PLAYLISTS
		for (const {
			access_token,
			id: playlistId,
			data: playlistTracks,
		} of dzrPlaylists) {
			// GET TRACKS TO ADD
			const playlistTracksId = playlistTracks.map((track) => track.id);
			const tracksToAdd = playlistsTracks.filter(
				(track) => !playlistTracksId.includes(track)
			);
			if (tracksToAdd.length) {
				await postPlaylistTracks(
					access_token,
					playlistId,
					tracksToAdd.join(',')
				);
				logger.info(
					`${tracksToAdd.length} track(s) added to playlist ${playlistId}.`
				);
			}

			// UPDATE ORDER
			if (playlistTracksId.join(',') !== playlistsTracks.join(',')) {
				await postPlaylistTracksOrder(
					access_token,
					playlistId,
					playlistsTracks.join(',')
				);
				logger.info(`Tracks ordered in playlist ${playlistId}.`);
			}
		}

		logger.info('Script ended');
	} catch (e) {
		logger.error(e);
	}
};
