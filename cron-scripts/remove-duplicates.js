const {
	getPlaylistTracks,
	deletePlaylistTracks,
} = require('../common/dzr-utils');

const SCRIPT = 'Remove duplicates';

exports.removeDuplicates = async ({
	playlistId,
	access_token,
}) => {

	try {
		console.log(`[${SCRIPT}]`, 'Script started...');
		
		const data = await getPlaylistTracks(access_token, playlistId);
		
		if (!data.error) {
			// GROUP TRACKS BY ARTIST 
			const trackTitles = data.data.reduce((acc, curr)=>{
				if (!acc[curr.title_short]) {
					acc[curr.title_short] = [];
				}
				acc[curr.title_short].push(curr);
				return acc;
			}, {});
			
			// KEEP ARTISTS WITH MORE THAN 1 TRACK
			const sameTitleTracks = Object.keys(trackTitles)
				.filter((id)=>trackTitles[id].length > 1)
				.reduce((acc, curr)=>{
					acc[curr] = trackTitles[curr];
					return acc;
				}, {});
			
			// CHECK IF TRACKS ARE THE SAME
			const tracksToRemove = [];
			Object.values(sameTitleTracks).forEach((tracks)=>{
				tracks.forEach((track, index)=>{
					const otherTracks = [...tracks];
					otherTracks.splice(index, 1);
					otherTracks.forEach((otherTrack)=>{
						if (
							track.artist.id === otherTrack.artist.id
							&& track.album.id !== otherTrack.album.id
							&& track.duration === otherTrack.duration
							&& track.time_add > otherTrack.time_add
						) {
							tracksToRemove.push(track.id);
						}
					});
				});
			});
			
			// REMOVE TRACKS FROM PLAYLIST
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

			console.log(`[${SCRIPT}]`, 'Script ended!');
		} else {
			console.error(`[${SCRIPT}]`, 'API Error Response', data.error);
		}
	} catch (e) {
		console.error(`[${SCRIPT}]`, e);
	}
};