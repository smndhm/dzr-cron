const { lastFavTracks } = require("./cron-last-fav-tracks");

// MOCK
const {
  nockUserMePermissions,
  nockUserMeTracks,
  nockGetPlaylistIdTracks,
  nockDeletePlaylistIdTracks,
  nockPostPlaylistIdTracks,
  cleanAll,
  nockThrowError,
  nockRespondError,
} = require("./mocks/nocks");
const mockEntityDeezerTracks = require("./mocks/api-deezer-tracks");

const cronArguments = { access_token: "BLUBLU", playlistId: 1234567890 };

describe("Last Favorite Tracks Cron", () => {
  afterEach(() => {
    cleanAll();
  });

  test("lastFavTracks should be defined", () => {
    expect(lastFavTracks).toBeDefined();
  });

  test("Should throw without parameters", async () => {
    try {
      await lastFavTracks();
    } catch (err) {
      expect(err.message).toEqual(
        expect.stringContaining("Cannot destructure property")
      );
    }
  });

  test("Should return on missing mendatory parameters", async () => {
    const cron = await lastFavTracks({});
    expect(cron).toBeUndefined();
  });

  test("Should return on access_token without permissions", async () => {
    const mockUserMePermissions = nockUserMePermissions(false);

    await lastFavTracks(cronArguments);

    expect(mockUserMePermissions.isDone()).toBeTruthy();
  });

  test("Should not update the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions();
    const mockUserMeTracks = nockUserMeTracks({ ...mockEntityDeezerTracks });
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks(cronArguments);

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeFalsy();
  });

  test("Should only add track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions();
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks(cronArguments);

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should add new track and remove explicit lyrics track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions();
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    favTracks.data[0].explicit_lyrics = true;
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks({
      ...cronArguments,
      noExplicitLyrics: true,
    });

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should add and delete track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions();
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks({ ...cronArguments, nbTracks: 5 });

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should throw on api error response", async () => {
    const mockRespondError = nockThrowError(/\/user\/me\/permissions/);

    const cron = await lastFavTracks(cronArguments);

    expect(cron).toBeUndefined();
    expect(mockRespondError.isDone()).toBeTruthy();
  });

  test("Should return if api respond an error", async () => {
    const mockRespondError = nockRespondError(/\/user\/me\/permissions/);

    const cron = await lastFavTracks(cronArguments);

    expect(cron).toBeUndefined();
    expect(mockRespondError.isDone()).toBeTruthy();
  });
});
