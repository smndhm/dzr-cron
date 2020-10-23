const {
  getUserPermissions,
  getUserTracks,
  getPlaylistTracks,
  deletePlaylistTracks,
  postPlaylistTracks,
} = require("../common/dzr-utils");

exports.lastFavTracks = async ({
  access_token,
  playlistId,
  nbTracks = 50,
  noExplicitLyrics = false,
}) => {
  if (!access_token || !playlistId) {
    console.error("[Cron Last Fav Tracks]", "Missing parameters in cron");
    return;
  }

  try {
    console.log("[Cron Last Fav Tracks]", "Script started...");

    // GET USER PERMISSIONS
    const dzrPermissions = await getUserPermissions(access_token);

    if (
      !dzrPermissions ||
      !dzrPermissions.manage_library ||
      !dzrPermissions.delete_library
    ) {
      console.error(
        "[Cron Last Fav Tracks]",
        "access_token missing permissions"
      );
      return;
    }

    // GET LAST FAV TRACKS
    let dzrFavTracks = await getUserTracks(access_token);

    // most recent first
    dzrFavTracks.sort((a, b) => b.time_add - a.time_add);
    // filter tracks
    dzrFavTracks = dzrFavTracks.filter(
      (track) => track.readable && (!noExplicitLyrics || !track.explicit_lyrics)
    );
    // limit to N tracks
    dzrFavTracks = dzrFavTracks.slice(0, nbTracks);
    const dzrFavTracksId = dzrFavTracks.map((track) => track.id);

    // GET OFFLINE PLAYLIST TRACKS
    const { data: dzrOfflinePlaylistTracks } = await getPlaylistTracks(
      access_token,
      playlistId
    );
    const dzrOfflinePlaylistTracksId = dzrOfflinePlaylistTracks.map(
      (track) => track.id
    );

    // REMOVE TRACKS FROM PLAYLIST
    const tracksToRemove = dzrOfflinePlaylistTracksId.filter(
      (track) => !dzrFavTracksId.includes(track)
    );
    if (tracksToRemove.length) {
      await deletePlaylistTracks(
        access_token,
        playlistId,
        tracksToRemove.join(",")
      );
      console.log(
        "[Cron Last Fav Tracks]",
        `${tracksToRemove.length} track(s) removed from playlist ${playlistId}.`
      );
    }

    // GET TRACKS TO ADD
    const tracksToAdd = dzrFavTracksId.filter(
      (track) => !dzrOfflinePlaylistTracksId.includes(track)
    );
    if (tracksToAdd.length) {
      await postPlaylistTracks(access_token, playlistId, tracksToAdd.join(","));
      console.log(
        "[Cron Last Fav Tracks]",
        `${tracksToAdd.length} track(s) added to playlist ${playlistId}.`
      );
    }

    console.log("[Cron Last Fav Tracks]", "Script ended!");
  } catch (e) {
    console.error("[Cron Last Fav Tracks]", e);
  }
};
