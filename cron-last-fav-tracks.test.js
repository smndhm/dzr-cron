const { lastFavTracks } = require("./cron-last-fav-tracks");

// MOCK
const nock = require("nock");
const mockEntityDeezerTracks = require("./mocks/api-deezer-tracks");

const nockUserMePermissions = (value = true) =>
  nock("https://api.deezer.com")
    .get(/\/user\/me\/permissions/)
    .reply(200, {
      permissions: {
        basic_access: value,
        offline_access: value,
        manage_library: value,
        delete_library: value,
      },
    });

const nockUserMeTracks = (response) =>
  nock("https://api.deezer.com")
    .get(/\/user\/me\/tracks/)
    .reply(200, response);

const nockPlaylistIdTracks = () =>
  nock("https://api.deezer.com")
    .get(/\/playlist\/\d+\/tracks/)
    .reply(200, {
      ...mockEntityDeezerTracks,
    });

const nockDeletePlaylistIdTracks = () =>
  nock("https://api.deezer.com")
    .delete(/\/playlist\/\d+\/tracks/)
    .reply(200, true);

const nockPostPlaylistIdTracks = () =>
  nock("https://api.deezer.com")
    .post(/\/playlist\/\d+\/tracks/)
    .reply(200, true);

const cronArguments = { access_token: "BLUBLU", playlistId: 1234567890 };
describe("Last Favorite Tracks Cron", () => {
  afterEach(() => {
    nock.cleanAll();
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
    const mockUserMePermissions = nockUserMePermissions(true);
    const mockUserMeTracks = nockUserMeTracks({ ...mockEntityDeezerTracks });
    const mockPlaylistIdTracks = nockPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks(cronArguments);

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeFalsy();
  });

  test("Should only add track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions(true);
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockPlaylistIdTracks = nockPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks(cronArguments);

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should add new track and remove explicit lyrics track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions(true);
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    favTracks.data[0].explicit_lyrics = true;
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockPlaylistIdTracks = nockPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks({
      ...cronArguments,
      noExplicitLyrics: true,
    });

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should add and delete track to the playlist", async () => {
    const mockUserMePermissions = nockUserMePermissions(true);
    const favTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    favTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockUserMeTracks = nockUserMeTracks(favTracks);
    const mockPlaylistIdTracks = nockPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastFavTracks({ ...cronArguments, nbTracks: 5 });

    expect(mockUserMePermissions.isDone()).toBeTruthy();
    expect(mockUserMeTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test("Should throw on api error response", async () => {
    const mockUserMePermissions = nock("https://api.deezer.com")
      .get(/\/user\/me\/permissions/)
      .reply(500, {});

    const cron = await lastFavTracks(cronArguments);
    expect(cron).toBeUndefined();
    expect(mockUserMePermissions.isDone()).toBeTruthy();
  });
});
