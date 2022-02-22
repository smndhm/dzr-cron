const {
	playlistsFilter,
	getPlaylistTracks,
	deletePlaylistTracks,
	postPlaylistTracks,
} = require('../common/dzr-utils');

const SCRIPT = 'Cron Last Tracks';

exports.lastTracks = async ({
	playlistId,
	access_token,
	playlists = [],
	nbTracks = 50,
	noExplicitLyrics = false,
}) => {
	playlists = playlistsFilter(playlists);

	if (playlists.length === 0) {
		console.error(`[${SCRIPT}]`, 'Wrong configuration for cron arguments');
		return;
	}

	try {
		console.log(`[${SCRIPT}]`, 'Script started...');

		// GET ALL PLAYLISTS
		const dzrPlaylists = [];
		for await (const { access_token, playlistId } of playlists) {
			const data = await getPlaylistTracks(access_token, playlistId);
			if (!data.error) {
				dzrPlaylists.push(data.data);
			} else {
				console.error(`[${SCRIPT}]`, 'API Error Response', data.error);
			}
		}

		if (dzrPlaylists.length === 0) {
			console.error(`[${SCRIPT}]`, 'Not enought valid playlists.');
			return;
		}

		let dzrTracksId = [];
		for (let playlistTracks of dzrPlaylists) {
			// most recent first
			playlistTracks.sort((a, b) => b.time_add - a.time_add);
			// filter tracks
			playlistTracks = playlistTracks.filter(
				(track) => track.readable // this params is sometimes not correct...
          && (!noExplicitLyrics || !track.explicit_lyrics) // remove tracks with explicit lyrics
          && !dzrTracksId.includes(track.id),
			);
			// limit to N tracks
			playlistTracks = playlistTracks.slice(0, nbTracks);
			// Add tracks
			dzrTracksId = [
				...dzrTracksId,
				...playlistTracks.map((track) => track.id),
			];
		}

		// GET OFFLINE PLAYLIST TRACKS
		const { data: dzrOfflinePlaylistTracks } = await getPlaylistTracks(
			access_token,
			playlistId,
		);

		const dzrOfflinePlaylistTracksId = dzrOfflinePlaylistTracks.map(
			(track) => track.id,
		);

		// REMOVE TRACKS FROM PLAYLIST
		const tracksToRemove = dzrOfflinePlaylistTracksId.filter(
			(track) => !dzrTracksId.includes(track),
		);
		if (tracksToRemove.length) {
			await deletePlaylistTracks(
				access_token,
				playlistId,
				tracksToRemove.join(','),
			);
			console.log(
				`[${SCRIPT}]`,
				`${tracksToRemove.length} track(s) removed from playlist ${playlistId}.`,
			);
		}

		// GET TRACKS TO ADD
		const tracksToAdd = dzrTracksId.filter(
			(track) => !dzrOfflinePlaylistTracksId.includes(track),
		);
		if (tracksToAdd.length) {
			await postPlaylistTracks(access_token, playlistId, tracksToAdd.join(','));
			console.log(
				`[${SCRIPT}]`,
				`${tracksToAdd.length} track(s) added to playlist ${playlistId}.`,
			);
		}

		console.log(`[${SCRIPT}]`, 'Script ended!');
	} catch (e) {
		console.error(`[${SCRIPT}]`, e);
	}
};
