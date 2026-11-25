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
import { getErrorCount, resetErrorCount } from '../utils/logger';

const cronArguments: Playlist & { playlists: AtLeastOne<Playlist> } = {
  access_token: 'access_token',
  playlistId: 1234567890,
  playlists: [{ access_token: 'access_token', playlistId: 9876543210 }],
};

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

  // A source that could not be read is not an empty source. The destination is
  // set to exactly what was selected, so going on with the ones that answered
  // would take that person's ten tracks out of the family playlist.
  test('writes nothing when one source could not be read', async () => {
    resetErrorCount();
    const first = nockGetPlaylistIdTracks(1, { data: [{ id: 1, readable: true, explicit_lyrics: false, time_add: 1 }] });
    const refused = nockRespondError(/\/playlist\/\d+\/tracks/);
    const destination = nockGetPlaylistIdTracks(1, { data: [] });
    const removed = nockDeletePlaylistIdTracksCapture();
    const added = nockPostPlaylistIdTracksCapture();

    await lastTracks({
      ...cronArguments,
      playlists: [
        { access_token: 'access_token', playlistId: 1 },
        { access_token: 'access_token', playlistId: 2 },
      ],
    });

    expect(first.isDone()).toBeTruthy();
    expect(refused.isDone()).toBeTruthy();
    // It stopped before reading the destination, so it cannot have written it
    expect(destination.isDone()).toBeFalsy();
    expect(removed.scope.isDone()).toBeFalsy();
    expect(added.scope.isDone()).toBeFalsy();
    // Still red: the sync did not happen
    expect(getErrorCount()).toBe(1);
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
