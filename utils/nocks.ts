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

export const nockPostPlaylistIdTracks = (times = 1) =>
  nock('https://api.deezer.com')
    .post(/\/playlist\/\d+\/tracks/)
    .times(times)
    .reply(200);

// Same as above, but keeps the ids the script asked to remove
export const nockDeletePlaylistIdTracksCapture = () => {
  const captured: { songs?: string } = {};
  const scope = nock('https://api.deezer.com')
    .delete(/\/playlist\/\d+\/tracks/)
    .query((query) => {
      captured.songs = query.songs as string;
      return true;
    })
    .reply(200);
  return { scope, captured };
};

export const cleanAll = () => nock.cleanAll();

// nock 14 only emits a plain object as is, which leaves the request hanging:
// the error has to be a real Error for the client to reject.
export const nockThrowError = (regexp: RegExp) =>
  nock('https://api.deezer.com')
    .get(regexp)
    .replyWithError(Object.assign(new Error('Error'), { code: 500 }));

export const nockRespondError = (regexp: RegExp, times = 1) =>
  nock('https://api.deezer.com')
    .get(regexp)
    .times(times)
    .reply(200, { error: { type: 'Error', message: 'Error', code: 403 } });
