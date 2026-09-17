import newReleases from './new-releases';
import {
  cleanAll,
  nockGetFavouriteArtists,
  nockGetBatch,
  nockGetPlaylistIdTracks,
  nockPostPlaylistIdTracksCapture,
  nockRespondError,
} from '../utils/nocks';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const album = (id: number, release_date: string, record_type = 'album') => ({
  id,
  title: `Album ${id}`,
  release_date,
  record_type,
});

// The batch endpoint answers one entry per call, in order
const batch = (...entries: unknown[][]) => ({
  batch_result: entries.map((data) => ({ data })),
});

// A playlist holding nothing, so every released track is new
const emptyPlaylist = () => nockGetPlaylistIdTracks(1, { data: [] });

describe('new-releases', () => {
  afterEach(() => {
    cleanAll();
  });

  test('adds the tracks of a release inside the window', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today())]));
    nockGetBatch(batch([{ id: 101 }, { id: 102 }]));
    emptyPlaylist();
    const { scope, captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(scope.isDone()).toBeTruthy();
    expect(captured).toEqual(['101,102']);
  });

  test('ignores a release older than the window', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, daysAgo(20))]));
    const post = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789, days: 15 });

    expect(post.scope.isDone()).toBeFalsy();
  });

  test('keeps a release the window still covers', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, daysAgo(10))]));
    nockGetBatch(batch([{ id: 101 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789, days: 15 });

    expect(captured).toEqual(['101']);
  });

  test('adds nothing that is already in the playlist', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today())]));
    nockGetBatch(batch([{ id: 101 }, { id: 102 }]));
    nockGetPlaylistIdTracks(1, { data: [{ id: 101 }] });
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(captured).toEqual(['102']);
  });

  test('asks for an album released by two favourites only once', async () => {
    nockGetFavouriteArtists({ data: [{ id: 11 }, { id: 12 }] });
    nockGetBatch(batch([album(1, today())], [album(1, today())]));
    nockGetBatch(batch([{ id: 101 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(captured).toEqual(['101']);
  });

  test('keeps only the record types it was given', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today(), 'album'), album(2, today(), 'compile')]));
    nockGetBatch(batch([{ id: 101 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({
      access_token: 'token',
      playlistId: 123456789,
      recordTypes: ['album'],
    });

    expect(captured).toEqual(['101']);
  });

  test('adds nothing when no release falls in the window', async () => {
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, daysAgo(30))]));
    const post = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(post.scope.isDone()).toBeFalsy();
  });

  test('reports an error rather than throwing when the artists cannot be read', async () => {
    nockRespondError(/\/user\/me\/artists/);
    const post = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(post.scope.isDone()).toBeFalsy();
  });

  test('keeps going when one artist of a batch fails', async () => {
    nockGetFavouriteArtists({ data: [{ id: 11 }, { id: 12 }] });
    nockGetBatch({
      batch_result: [{ error: { message: 'nope' } }, { data: [album(2, today())] }],
    });
    nockGetBatch(batch([{ id: 201 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases({ access_token: 'token', playlistId: 123456789 });

    expect(captured).toEqual(['201']);
  });
});
