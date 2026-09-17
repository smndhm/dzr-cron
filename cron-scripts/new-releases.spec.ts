import newReleases from './new-releases';
import {
  cleanAll,
  nockGetFavouriteArtists,
  nockGetBatch,
  nockGetPlaylist,
  nockGetPlaylistIdTracks,
  nockPostPlaylistIdTracksCapture,
  nockPostPlaylistDescriptionCapture,
  nockPostPlaylistDescriptionError,
  nockRespondError,
} from '../utils/nocks';
import { getErrorCount } from '../utils/logger';

const asDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const today = () => asDate(Date.now());
const daysAgo = (days: number) => asDate(Date.now() - days * 24 * 60 * 60 * 1000);

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

const args = { access_token: 'token', playlistId: 123456789 };

describe('new-releases', () => {
  afterEach(() => {
    cleanAll();
  });

  test('adds the tracks of a release inside the window', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today())]));
    nockGetBatch(batch([{ id: 101 }, { id: 102 }]));
    emptyPlaylist();
    const { scope, captured } = nockPostPlaylistIdTracksCapture();
    nockPostPlaylistDescriptionCapture();

    await newReleases(args);

    expect(scope.isDone()).toBeTruthy();
    expect(captured).toEqual(['101,102']);
  });

  test('ignores a release older than the window', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, daysAgo(20))]));
    const post = nockPostPlaylistIdTracksCapture();
    nockPostPlaylistDescriptionCapture();

    await newReleases({ ...args, days: 15 });

    expect(post.scope.isDone()).toBeFalsy();
  });

  test('adds nothing that is already in the playlist', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today())]));
    nockGetBatch(batch([{ id: 101 }, { id: 102 }]));
    nockGetPlaylistIdTracks(1, { data: [{ id: 101 }] });
    const { captured } = nockPostPlaylistIdTracksCapture();
    nockPostPlaylistDescriptionCapture();

    await newReleases(args);

    expect(captured).toEqual(['102']);
  });

  test('asks for an album released by two favourites only once', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists({ data: [{ id: 11 }, { id: 12 }] });
    nockGetBatch(batch([album(1, today())], [album(1, today())]));
    nockGetBatch(batch([{ id: 101 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();
    nockPostPlaylistDescriptionCapture();

    await newReleases(args);

    expect(captured).toEqual(['101']);
  });

  test('keeps only the record types it was given', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists();
    nockGetBatch(batch([album(1, today(), 'album'), album(2, today(), 'compile')]));
    nockGetBatch(batch([{ id: 101 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();
    nockPostPlaylistDescriptionCapture();

    await newReleases({ ...args, recordTypes: ['album'] });

    expect(captured).toEqual(['101']);
  });

  test('reports an error rather than throwing when the artists cannot be read', async () => {
    nockGetPlaylist();
    nockRespondError(/\/user\/me\/artists/);
    const post = nockPostPlaylistIdTracksCapture();

    await newReleases(args);

    expect(post.scope.isDone()).toBeFalsy();
  });

  test('keeps going when one artist of a batch fails', async () => {
    nockGetPlaylist();
    nockGetFavouriteArtists({ data: [{ id: 11 }, { id: 12 }] });
    nockGetBatch({
      batch_result: [{ error: { message: 'nope' } }, { data: [album(2, today())] }],
    });
    nockGetBatch(batch([{ id: 201 }]));
    emptyPlaylist();
    const { captured } = nockPostPlaylistIdTracksCapture();

    await newReleases(args);

    expect(captured).toEqual(['201']);
  });

  describe('the mark left in the description', () => {
    test('starts from it rather than from the window', async () => {
      // Released eighty days ago, so only a mark can bring it back
      nockGetPlaylist({ description: 'Sorties [dzr-cron:2020-01-01]' });
      nockGetFavouriteArtists();
      nockGetBatch(batch([album(1, daysAgo(80))]));
      nockGetBatch(batch([{ id: 101 }]));
      emptyPlaylist();
      const { captured } = nockPostPlaylistIdTracksCapture();
      nockPostPlaylistDescriptionCapture();

      await newReleases({ ...args, days: 15 });

      expect(captured).toEqual(['101']);
    });

    test('ignores a release the mark has already covered', async () => {
      nockGetPlaylist({ description: `[dzr-cron:${today()}]` });
      nockGetFavouriteArtists();
      nockGetBatch(batch([album(1, daysAgo(10))]));
      const post = nockPostPlaylistIdTracksCapture();
      nockPostPlaylistDescriptionCapture();

      await newReleases(args);

      expect(post.scope.isDone()).toBeFalsy();
    });

    test('looks slightly further back than the day it wrote down', async () => {
      // The lag is what catches a release Deezer published after its own date
      nockGetPlaylist({ description: `[dzr-cron:${today()}]` });
      nockGetFavouriteArtists();
      nockGetBatch(batch([album(1, daysAgo(1))]));
      nockGetBatch(batch([{ id: 101 }]));
      emptyPlaylist();
      const { captured } = nockPostPlaylistIdTracksCapture();
      nockPostPlaylistDescriptionCapture();

      await newReleases(args);

      expect(captured).toEqual(['101']);
    });

    test('keeps what the owner wrote and replaces its own mark', async () => {
      nockGetPlaylist({ description: 'Sorties [dzr-cron:2020-01-01]' });
      nockGetFavouriteArtists();
      nockGetBatch(batch([]));
      const { scope, captured } = nockPostPlaylistDescriptionCapture();

      await newReleases(args);

      expect(scope.isDone()).toBeTruthy();
      expect(captured.description).toBe(`Sorties [dzr-cron:${today()}]`);
    });

    test('is not written at all when the answer carries no description', async () => {
      // Which is what a wrong field name looks like, and writing then would
      // replace whatever the owner wrote with a bare mark
      nockGetPlaylist({ id: 123456789 });
      nockGetFavouriteArtists();
      nockGetBatch(batch([]));
      const { scope } = nockPostPlaylistDescriptionCapture();

      await newReleases(args);

      expect(scope.isDone()).toBeFalsy();
    });

    test('turns the run red when Deezer refuses the write', async () => {
      // A 200 carrying an error is how Deezer says no, so nothing throws
      nockGetPlaylist({ description: 'Sorties' });
      nockGetFavouriteArtists();
      nockGetBatch(batch([]));
      nockPostPlaylistDescriptionError();

      const before = getErrorCount();
      await newReleases(args);

      expect(getErrorCount()).toBe(before + 1);
    });

    test('is left alone when an artist could not be read', async () => {
      nockGetPlaylist({ description: 'Sorties [dzr-cron:2020-01-01]' });
      nockGetFavouriteArtists();
      nockGetBatch({ batch_result: [{ error: { message: 'nope' } }] });
      const { scope } = nockPostPlaylistDescriptionCapture();

      await newReleases(args);

      expect(scope.isDone()).toBeFalsy();
    });
  });
});
