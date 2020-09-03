const myAccessToken = "frblublublublublublublublublublublublublublublublu";
const myPlaylistId = 1234567890;
const mySecondPlaylistId = 1234567890;
const otherAccessToken = "frblablablablablablablablablablablablablablablabla";
const otherPlaylistId = 9876543210;

exports.crons = [
  {
    // Car offline playlist
    refreshInterval: "0 * * * *", // Every hour
    action: "last-fav-tracks",
    arguments: {
      access_token: myAccessToken,
      playlistId: myPlaylistId,
    },
  },
  {
    // Car kids offline playlist
    refreshInterval: "0 0 * * *", // Every day
    action: "last-fav-tracks",
    arguments: {
      access_token: myAccessToken,
      playlistId: mySecondPlaylistId,
      nbTracks: 20,
      noExplicitLyrics: true,
    },
  },
  {
    // Kid playlist
    refreshInterval: "0 * * * *",
    action: "sync-playlists",
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
];
