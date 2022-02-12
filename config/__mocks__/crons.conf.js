const myAccessToken = 'frblublublublublublublublublublublublublublublublu';
const myPlaylistId = 1234567890;
const mySecondPlaylistId = 9876543210;
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';
const otherPlaylistId = 9876543210;

exports.crons = [
	{
		// Car offline playlist
		refreshInterval: '0 0 * * *', // Every hour
		action: 'last-tracks',
		playlistId: myPlaylistId,
		arguments: {
			access_token: myAccessToken,
			playlistId: mySecondPlaylistId,
		},
	},
	{
		// Kid playlist
		refreshInterval: '0 * * * *', // Every day
		action: 'sync-playlists',
		arguments: [
			{
				access_token: myAccessToken,
				playlistId: myPlaylistId,
			},
			{
				access_token: otherAccessToken,
				playlistId: otherPlaylistId,
			},
		],
	},
	{
		// unknown function
		refreshInterval: '0 * * * *',
		action: 'unknown-function',
	},
];
