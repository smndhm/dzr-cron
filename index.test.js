const mockLastFavTracks = jest.fn();
jest.mock("./cron-last-fav-tracks", () => {
  return {
    lastFavTracks: mockLastFavTracks,
  };
});

const mockSyncPlaylists = jest.fn();
jest.mock("./cron-sync-playlists", () => {
  return {
    syncPlaylists: mockSyncPlaylists,
  };
});

describe("Cron index", () => {
  afterEach(() => {
    mockLastFavTracks.mockClear();
    mockSyncPlaylists.mockClear();
  });

  test("Should run cron during 24 hour", async () => {
    jest.useFakeTimers("modern");
    const index = require("./index");
    expect(index).toBeDefined();
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(mockLastFavTracks).toBeCalledTimes(1);
    expect(mockSyncPlaylists).toBeCalledTimes(24);
  });
});
