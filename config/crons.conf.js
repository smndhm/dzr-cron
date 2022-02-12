const myAccessToken = 'frblublublublublublublublublublublublublublublublu';
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';


exports.crons = [
	{
		// Family favorites
		refreshInterval: '0 * * * *',
		action: 'last-tracks',
		arguments: {
			playlistId: 1234567890,
			playlists: [
				{ access_token: myAccessToken, playlistId: 9876543210 },
				{ access_token: myAccessToken, playlistId: 1357924680 },
				{ access_token: otherAccessToken, playlistId: 2468135790 },
			],
			nbTracks: 10,
		},
	},
	{
		// Car offline playlist
		refreshInterval: '0 * * * *',
		action: 'last-tracks',
		arguments: {
			playlistId: 1234567890,
			playlists: [
				{ access_token: myAccessToken, playlistId: 9876543210 }, 
			],
		},
	},
	{
		// Sync playlist
		refreshInterval: '0 * * * *',
		action: 'sync-playlists',
		arguments: [
			{
				access_token: myAccessToken,
				playlistId: 1234567890,
			},
			{
				access_token: otherAccessToken,
				playlistId: 9876543210,
			},
		],
	},
];
