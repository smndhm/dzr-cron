import lastTracks from './last-tracks';
// MOCK
import {
  cleanAll,
  nockGetPlaylistIdTracks,
  nockDeletePlaylistIdTracks,
  nockDeletePlaylistIdTracksCapture,
  nockPostPlaylistIdTracks,
  nockPostPlaylistIdTracksCapture,
  nockThrowError,
  nockRespondError,
} from '../utils/nocks';
import mockEntityDeezerTracks from '../__mocks__/api-deezer-tracks.json';
import { AtLeastOne, Playlist } from '../types';

const cronArguments: Playlist & { playlists: AtLeastOne<Playlist> } = {
  access_token: 'access_token',
  playlistId: 1234567890,
  playlists: [{ access_token: 'access_token', playlistId: 9876543210 }],
};

// Deezer gives time_add in seconds
const daysAgo = (days: number) => Math.round(Date.now() / 1000 - days * 24 * 60 * 60);
const source = (...tracks: [number, number][]) => ({
  data: tracks.map(([id, time_add]) => ({ id, readable: true, explicit_lyrics: false, time_add })),
});

describe('Last Tracks Cron', () => {
  afterEach(() => {
    cleanAll();
  });

  test('Should not update the playlist', async () => {
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(2);
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    const cron = await lastTracks(cronArguments);
    expect(cron).not.toBeDefined();

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeFalsy();
  });

  test('Should only add track to the playlist', async () => {
    const lastAddedTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    lastAddedTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(1, lastAddedTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastTracks(cronArguments);

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdAddedTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test('Should add new track and remove explicit lyrics track to the playlist', async () => {
    const lastAddedTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    lastAddedTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    lastAddedTracks.data[0].explicit_lyrics = true;
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(1, lastAddedTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastTracks({
      ...cronArguments,
      noExplicitLyrics: true,
    });

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdAddedTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  test('Should add and delete track to the playlist', async () => {
    const lastAddedTracks = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    lastAddedTracks.data.push({
      id: 10,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(1, lastAddedTracks);
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastTracks({ ...cronArguments, nbTracks: 5 });

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdAddedTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });

  // A track someone added to their playlist months ago is not news any more,
  // however near the top of their playlist it sits
  describe('addedWithinDays', () => {
    test('leaves out a track added to its playlist too long ago', async () => {
      nockGetPlaylistIdTracks(1, source([1, daysAgo(10)], [2, daysAgo(200)]));
      nockGetPlaylistIdTracks(1, { data: [] });
      const added = nockPostPlaylistIdTracksCapture();

      await lastTracks({ ...cronArguments, addedWithinDays: 183 });

      expect(added.captured).toEqual(['1']);
    });

    // The destination is set to exactly what was selected, so the limit takes
    // a track out on the run where it ages past it
    test('takes out a track that has aged past the limit', async () => {
      nockGetPlaylistIdTracks(1, source([1, daysAgo(10)], [2, daysAgo(200)]));
      nockGetPlaylistIdTracks(1, source([1, daysAgo(10)], [2, daysAgo(200)]));
      const removed = nockDeletePlaylistIdTracksCapture();
      const added = nockPostPlaylistIdTracksCapture();

      await lastTracks({ ...cronArguments, addedWithinDays: 183 });

      expect(removed.captured.songs).toBe('2');
      expect(added.scope.isDone()).toBeFalsy();
    });

    // No argument means no limit, which is what the car playlist wants
    test('keeps a track of any age when no limit is given', async () => {
      nockGetPlaylistIdTracks(1, source([1, daysAgo(900)]));
      nockGetPlaylistIdTracks(1, { data: [] });
      const added = nockPostPlaylistIdTracksCapture();

      await lastTracks(cronArguments);

      expect(added.captured).toEqual(['1']);
    });
  });

  test('Should throw on api error response', async () => {
    const mockRespondError = nockThrowError(/\/playlist\/\d+\/tracks/);

    const cron = await lastTracks(cronArguments);

    expect(cron).toBeUndefined();
    expect(mockRespondError.isDone()).toBeTruthy();
  });

  test('Should return if api respond an error', async () => {
    const mockRespondError = nockRespondError(/\/playlist\/\d+\/tracks/);

    const cron = await lastTracks(cronArguments);

    expect(cron).toBeUndefined();
    expect(mockRespondError.isDone()).toBeTruthy();
  });
});
