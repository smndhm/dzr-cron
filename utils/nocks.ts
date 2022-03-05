import nock from 'nock';
import mockEntityDeezerTracks from '../__mocks__/api-deezer-tracks.json';

export const nockGetPlaylistIdTracks = (
  times = 1,
  response = {
    ...mockEntityDeezerTracks,
  },
) =>
  nock('https://api.deezer.com')
    .get(/\/playlist\/\d+\/tracks/)
    .times(times)
    .reply(200, response);

export const nockDeletePlaylistIdTracks = () =>
  nock('https://api.deezer.com')
    .delete(/\/playlist\/\d+\/tracks/)
    .reply(200);
// .reply(200, true);

export const nockPostPlaylistIdTracks = (times = 1) =>
  nock('https://api.deezer.com')
    .post(/\/playlist\/\d+\/tracks/)
    .times(times)
    .reply(200);
// .reply(200, true);

export const cleanAll = () => nock.cleanAll();

export const nockThrowError = (regexp: RegExp) =>
  nock('https://api.deezer.com').get(regexp).replyWithError({
    message: 'Error',
    code: 500,
  });

export const nockRespondError = (regexp: RegExp, times = 1) =>
  nock('https://api.deezer.com')
    .get(regexp)
    .times(times)
    .reply(200, { error: { type: 'Error', message: 'Error', code: 403 } });
