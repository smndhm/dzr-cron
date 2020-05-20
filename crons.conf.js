const access_token = "frblublublublublublublublublublublublublublublublu";
const playlistId = 1234567890;

exports.crons = [
  {
    // Car offline playlist
    refreshInterval: "0 * * * *", // Every hour
    action: "last-fav-tracks",
    arguments: {
      access_token,
      playlistId,
    },
  },
  {
    // Car kids offline playlist
    refreshInterval: "0 0 * * *", // Every day
    action: "last-fav-tracks",
    arguments: {
      access_token,
      playlistId,
      nbTracks: 20,
      noExplicitLyrics: true,
    },
  },
];
