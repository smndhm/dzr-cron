// .ENV
require("dotenv").config();

if (!process.env.DZR_ACCESS_TOKEN || !process.env.DZR_PLAYLIST_ID) {
  console.error(".env not configured");
  return;
}

// AXIOS PARAMS
const axios = require("axios");
axios.defaults.baseURL = "https://api.deezer.com";
// axios params
const access_token = process.env.DZR_ACCESS_TOKEN;
const params = {
  access_token,
};

// SET QUERY SETTINGS
const dzrQuerySettings = {
  nbTracks: process.env.PLAYLIST_NB_TRACKS || 50,
  noExplicitLyrics: process.env.PLAYLIST_NO_EXPLICIT === "true",
};

(async () => {
  try {
    // GET USER PERMISSIONS
    const {
      data: { permissions: dzrPermissions },
    } = await axios({
      method: "get",
      url: "/user/me/permissions",
      params,
    });

    if (
      !dzrPermissions ||
      !dzrPermissions.manage_library ||
      !dzrPermissions.delete_library
    ) {
      console.error("access_token missing permissions");
      return;
    }

    // GET LAST FAV TRACKS
    let {
      data: { data: dzrFavTracks },
    } = await axios({
      method: "get",
      url: "/user/me/tracks",
      params: {
        access_token,
        limit: 2000,
      },
    });
    // most recent first
    dzrFavTracks.sort((a, b) => b.time_add - a.time_add);
    // filter tracks
    dzrFavTracks = dzrFavTracks.filter(
      (track) =>
        track.readable &&
        (!dzrQuerySettings.noExplicitLyrics || track.explicit_lyrics)
    );
    // limit to N tracks
    dzrFavTracks = dzrFavTracks.slice(0, dzrQuerySettings.nbTracks);
    const dzrFavTracksId = dzrFavTracks.map((track) => track.id);

    // GET OFFLINE PLAYLIST TRACKS
    const {
      data: {
        tracks: { data: dzrOfflinePlaylistTracks },
      },
    } = await axios({
      method: "get",
      url: `/playlist/${process.env.DZR_PLAYLIST_ID}`,
      params,
    });
    const dzrOfflinePlaylistTracksId = dzrOfflinePlaylistTracks.map(
      (track) => track.id
    );

    // REMOVE TRACKS FROM PLAYLIST
    const tracksToRemove = dzrOfflinePlaylistTracksId.filter(
      (track) => !dzrFavTracksId.includes(track)
    );
    if (tracksToRemove.length) {
      await axios({
        method: "delete",
        url: `/playlist/${process.env.DZR_PLAYLIST_ID}/tracks`,
        params: {
          access_token,
          songs: tracksToRemove.join(","),
        },
      });
    }

    // GET TRACKS TO ADD
    const tracksToAdd = dzrFavTracksId.filter(
      (track) => !dzrOfflinePlaylistTracksId.includes(track)
    );
    if (tracksToAdd.length) {
      const response = await axios({
        method: "post",
        url: `/playlist/${process.env.DZR_PLAYLIST_ID}/tracks`,
        params: {
          access_token,
          songs: tracksToAdd.join(","),
        },
      });
    }
  } catch (e) {
    console.error(e);
  }
})();
