import removeDuplicates from './remove-duplicates';
// MOCKS
import {
  cleanAll,
  nockGetPlaylistIdTracks,
  nockDeletePlaylistIdTracks,
  nockDeletePlaylistIdTracksCapture,
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

  test('Should remove every later copy, and each one once', async () => {
    // Track 9 already exists with album 9 and time_add 9
    const playlistWithDuplicates = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    playlistWithDuplicates.data.push(
      {
        id: 10,
        title_short: '9',
        artist: { id: 9 },
        album: { id: 10 },
        duration: 9,
        readable: true,
        explicit_lyrics: false,
        time_add: 10,
      },
      {
        id: 11,
        title_short: '9',
        artist: { id: 9 },
        album: { id: 11 },
        duration: 9,
        readable: true,
        explicit_lyrics: false,
        time_add: 11,
      },
    );
    nockGetPlaylistIdTracks(1, playlistWithDuplicates);
    const { captured } = nockDeletePlaylistIdTracksCapture();

    await removeDuplicates(cronArguments);

    // 11 is a duplicate of both 9 and 10, and still has to be asked for once
    expect(captured.songs).toBe('10,11');
  });

  test('Should keep a track whose duration differs', async () => {
    const playlistWithOtherVersion = JSON.parse(JSON.stringify(mockEntityDeezerTracks));
    playlistWithOtherVersion.data.push({
      id: 10,
      title_short: '9',
      artist: { id: 9 },
      album: { id: 10 },
      duration: 42,
      readable: true,
      explicit_lyrics: false,
      time_add: 10,
    });
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks(1, playlistWithOtherVersion);
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
