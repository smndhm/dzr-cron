import removeDuplicates from './remove-duplicates';
// MOCKS
import {
  cleanAll,
  nockGetPlaylistIdTracks,
  nockDeletePlaylistIdTracks,
  nockRespondError,
  nockThrowError
} from '../utils/nocks';
import mockEntityDeezerTracks from '../__mocks__/api-deezer-tracks.json';
import { Playlist } from '../types';

const cronArguments: Playlist = { access_token: 'BLUBLU', playlistId: 1234567890 };

describe('Sync Playlists Cron', () => {
  afterEach(() => {
    cleanAll();
  });

  
  test('Should return if api respond an error', async () => {
    const mockRespondError = nockRespondError(/\/playlist\/\d+\/tracks/);
    
    await removeDuplicates(cronArguments);

    expect(mockRespondError.isDone()).toBeTruthy();
  });

  test('Should return if api throw an error', async () => {
    const mockRespondError = nockThrowError(/\/playlist\/\d+\/tracks/);
    
    await removeDuplicates(cronArguments);

    expect(mockRespondError.isDone()).toBeTruthy();
  });

  test('Should not delete track', async () => {
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(1);
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();

    await removeDuplicates(cronArguments);

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeFalsy();
  });

  test.each(['9', '9 (blu)'])('Should delete duplicated track "%s"', async (title_short) => {
    const playlistWithDuplicateTrack = JSON.parse(
      JSON.stringify(mockEntityDeezerTracks)
    );
    playlistWithDuplicateTrack.data.push({
      id: 10,
      title_short,
      artist: {
        id: 9,
      },
      album: {
        id: 10,
      },
      duration: 9,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(
      1,
      playlistWithDuplicateTrack
    );
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();

    await removeDuplicates(cronArguments);

    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
  });
});
