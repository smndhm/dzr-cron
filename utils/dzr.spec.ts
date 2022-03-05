import { 
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
  nockRespondError
} from './nocks';

describe('dzr', () => {
  afterEach(() => {
    cleanAll();
  });

  test('getPlaylistTracks', async () => {
    const mockGetPlaylistIdTracks = nockGetPlaylistIdTracks();
    await getPlaylistTracks('token', 123456789);
    expect(mockGetPlaylistIdTracks.isDone()).toBeTruthy();
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
	
  test('Should throw an error', async () => {
    nockThrowError(/\/playlist\/\d+\/tracks/);
    await expect(getPlaylistTracks('token', 123456789)).rejects.toMatchObject({
      message: 'Error',
      code: 500,
    });
  });

  test('Should respond an error', async () => {
    nockRespondError(/\/playlist\/\d+\/tracks/);
    await expect(getPlaylistTracks('token', 123456789)).resolves.toMatchObject({ error: { type: 'Error', message: 'Error', code: 403 } });
  });

});
