// AXIOS PARAMS
const axios = require("axios");
axios.defaults.baseURL = "https://api.deezer.com";

exports.syncPlaylists = async (playlists) => {
  if (!playlists || !Array.isArray(playlists) || !playlists.length) {
    console.error(
      "[Cron Sync Playlist]",
      "Missing or wrong parameters in cron"
    );
    return;
  } else if (playlists.length === 1) {
    console.error("[Cron Sync Playlist]", "Needs at least 2 playlists");
    return;
  }

  // KEEP PLAYLISTS WITH NEEDED PARAMETERS
  playlists = playlists.filter(
    (playlist) => playlist.access_token && playlist.playlistId
  );

  if (playlists.length < 2) {
    console.error("[Cron Sync Playlist]", "Missing parameters in playlists");
    return;
  }

  try {
    console.log("[Cron Sync Playlist]", "Script started...");

    // GET ALL PLAYLISTS
    let dzrPlaylists = await Promise.all(
      playlists.map(async ({ access_token, playlistId }) => {
        const { data } = await axios({
          method: "get",
          url: `/playlist/${playlistId}`,
          params: {
            access_token,
            limit: 2000,
          },
        });
        // ADD PLAYLIST ACCESS TOKEN TO RESPONSE
        if (!data.error) {
          data.access_token = access_token;
        }
        return data;
      })
    );

    // CHECK IF ERROR
    const dzrErrors = dzrPlaylists.filter((playlist) => playlist.error);

    if (dzrErrors.length) {
      console.error(
        "[Cron Sync Playlist]",
        `${dzrErrors.length} of ${dzrPlaylists.length} playlist(s) in error.`
      );
      dzrPlaylists = dzrPlaylists.filter((playlist) => !playlist.error);
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
      // ORDER BY TIME ADD
      .sort((a, b) => a.time_add - b.time_add)
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
