// AXIOS PARAMS
const axios = require("axios");
axios.defaults.baseURL = "https://api.deezer.com";

exports.syncPlaylists = async (playlists = []) => {
  playlists = (Array.isArray(playlists) ? playlists : []).filter(
    (playlist) => playlist.access_token && playlist.playlistId
  );

  if (playlists.length < 2) {
    console.error(
      "[Cron Sync Playlist]",
      "Wrong configuration for cron arguments"
    );
    return;
  }

  try {
    console.log("[Cron Sync Playlist]", "Script started...");

    // GET ALL PLAYLISTS
    const dzrPlaylists = [];
    for await (const { access_token, playlistId } of playlists) {
      const { data } = await axios({
        method: "get",
        url: `/playlist/${playlistId}`,
        params: {
          access_token,
          limit: 2000,
        },
      });
      if (!data.error) {
        data.access_token = access_token;
        dzrPlaylists.push(data);
      } else {
        console.error("[Cron Sync Playlist]", "API Error Response", data.error);
      }
    }

    if (dzrPlaylists.length < 2) {
      console.error("[Cron Sync Playlist]", "Not enought valid playlists.");
      return;
    }

    // GET TRACK LIST
    const playlistsTracks = dzrPlaylists
      //GROUP ALL TRACKS
      .reduce((acc, curr) => {
        return [...acc, ...curr.tracks.data];
      }, [])
      // ORDER BY TIME ADD (IF SAME, ORDER BY ID)
      .sort((a, b) =>
        a.time_add - b.time_add !== 0 ? a.time_add - b.time_add : a.id - b.id
      )
      // IF 2 TRACS ARE THE SAME, KEEP FIRST ADDED
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
      tracks: { data: playlistTracks },
    } of dzrPlaylists) {
      // GET TRACKS TO ADD
      const playlistTracksId = playlistTracks.map((track) => track.id);
      const tracksToAdd = playlistsTracks.filter(
        (track) => !playlistTracksId.includes(track)
      );
      if (tracksToAdd.length) {
        await axios({
          method: "post",
          url: `/playlist/${playlistId}/tracks`,
          params: {
            access_token,
            songs: tracksToAdd.join(","),
          },
        });
        console.log(
          "[Cron Sync Playlist]",
          `${tracksToAdd.length} track(s) added to playlist ${playlistId}.`
        );
      }

      // UPDATE ORDER
      if (playlistTracksId.join(",") !== playlistsTracks.join(",")) {
        await axios({
          method: "post",
          url: `/playlist/${playlistId}/tracks`,
          params: {
            access_token,
            order: playlistsTracks.join(","),
          },
        });
        console.log(
          "[Cron Sync Playlist]",
          `Tracks ordered in playlist ${playlistId}.`
        );
      }
    }

    console.log("[Cron Sync Playlist]", "Script ended!");
  } catch (e) {
    console.error("[Cron Sync Playlist]", e);
  }
};
