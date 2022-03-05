import lastTracks from './last-tracks';
// MOCK
import { 
  cleanAll,
  nockGetPlaylistIdTracks, 
  nockDeletePlaylistIdTracks,
  nockPostPlaylistIdTracks,
  nockThrowError,
  nockRespondError
} from '../utils/nocks';
import mockEntityDeezerTracks from '../__mocks__/api-deezer-tracks.json';
import { AtLeastOne, Playlist } from '../types';

const cronArguments: Playlist & {playlists: AtLeastOne<Playlist>} = {
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
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(
      1,
      lastAddedTracks
    );
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
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(
      1,
      lastAddedTracks
    );
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
    const mockGetPlaylistIdAddedTracks = nockGetPlaylistIdTracks(
      1,
      lastAddedTracks
    );
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();

    await lastTracks({ ...cronArguments, nbTracks: 5 });

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockGetPlaylistIdAddedTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
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
