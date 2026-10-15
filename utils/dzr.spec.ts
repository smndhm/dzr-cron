import nock from 'nock';
import { 
  TransientError,
  getPlaylistTracks,
  deletePlaylistTracks,
  postPlaylistTracks,
  postPlaylistTracksOrder
} from './dzr';
import {
  cleanAll,
  nockGetPlaylistIdTracks,
  nockDeletePlaylistIdTracks,
  nockPostPlaylistIdTracks,
  nockThrowError,
  nockRespondError,
  nockStatus
} from './nocks';

describe('dzr', () => {
  // The retry would otherwise hold every one of these tests for a second
  beforeAll(() => {
    process.env.DZR_RETRY_DELAY_MS = '0';
  });

  afterAll(() => {
    delete process.env.DZR_RETRY_DELAY_MS;
  });

  afterEach(() => {
    cleanAll();
  });

  test('getPlaylistTracks', async () => {
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    await getPlaylistTracks('token', 123456789);
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
  });    
	
  test('splits a write too long for one url', async () => {
    // A whole album at a time gets there, so both writes chunk at a hundred
    const mockPost = nockPostPlaylistIdTracks(3);
    await postPlaylistTracks('token', 123456789, Array.from({ length: 250 }, (_, i) => i));
    expect(mockPost.isDone()).toBeTruthy();
  });

  test('deletePlaylistTracks', async () => {
    const mockDeletePlaylistIdTracks = nockDeletePlaylistIdTracks();
    await deletePlaylistTracks('token', 123456789, [1, 2]);
    expect(mockDeletePlaylistIdTracks.isDone()).toBeTruthy();
  });    
	
  test('postPlaylistTracks', async () => {
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();
    await postPlaylistTracks('token', 123456789, [1, 2]);
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });    
	
  test('postPlaylistTracksOrder', async () => {
    const mockPostPlaylistIdTracks = nockPostPlaylistIdTracks();
    await postPlaylistTracksOrder('token', 123456789, [1, 2]);
    expect(mockPostPlaylistIdTracks.isDone()).toBeTruthy();
  });    
	
  // Nine runs in a hundred died on a 504 from the gateway in front of Deezer,
  // which says nothing about the request itself
  test('sends a request again when the gateway times out', async () => {
    const timeout = nockStatus(/\/playlist\/\d+\/tracks/, 504);
    const second = nockGetPlaylistIdTracks();

    await expect(getPlaylistTracks('token', 123456789)).resolves.toBeDefined();

    expect(timeout.isDone()).toBeTruthy();
    expect(second.isDone()).toBeTruthy();
  });

  // Once only: a gateway that times out twice in a second will not answer on a
  // third try, and the next run is hours away with the mark holding its place
  test('gives up after one more try, saying it may be worth carrying on', async () => {
    const timeouts = nockStatus(/\/playlist\/\d+\/tracks/, 504, 2);

    await expect(getPlaylistTracks('token', 123456789)).rejects.toThrow(TransientError);

    expect(timeouts.isDone()).toBeTruthy();
  });

  test('sends a request again when the connection drops', async () => {
    nockThrowError(/\/playlist\/\d+\/tracks/, 2);
    await expect(getPlaylistTracks('token', 123456789)).rejects.toThrow(TransientError);
  });

  // A refused token is not transient: trying again wastes a run, and the caller
  // must not carry on without the answer
  test('does not send a refused request again', async () => {
    const refused = nockStatus(/\/playlist\/\d+\/tracks/, 403);

    const failed = getPlaylistTracks('token', 123456789);
    await expect(failed).rejects.toThrow('Deezer answered 403');
    await expect(failed).rejects.not.toThrow(TransientError);

    expect(refused.isDone()).toBeTruthy();
    expect(nock.isDone()).toBeTruthy();
  });

  test('Should respond an error', async () => {
    nockRespondError(/\/playlist\/\d+\/tracks/);
    await expect(getPlaylistTracks('token', 123456789)).resolves.toMatchObject({ error: { type: 'Error', message: 'Error', code: 403 } });
  });

});
