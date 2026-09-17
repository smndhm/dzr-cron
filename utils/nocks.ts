import nock from 'nock';
import mockEntityDeezerTracks from '../__mocks__/api-deezer-tracks.json';

// What nock hands back as a json body
type Body = Record<string, unknown>;

export const nockGetPlaylistIdTracks = (
  times = 1,
  response: Body = {
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

export const nockGetFavouriteArtists = (
  response: Body = { data: [{ id: 11, name: 'Artist' }] },
) =>
  nock('https://api.deezer.com')
    .get(/\/user\/me\/artists/)
    .reply(200, response);

// The script calls the batch endpoint once for the albums and once for their
// tracks, so the interceptors answer in the order they are declared.
export const nockGetBatch = (response: Body) =>
  nock('https://api.deezer.com')
    .get(/\/batch/)
    .reply(200, response);

// Same as nockPostPlaylistIdTracks, but keeps the ids the script added
export const nockPostPlaylistIdTracksCapture = (times = 1) => {
  const captured: string[] = [];
  const scope = nock('https://api.deezer.com')
    .post(/\/playlist\/\d+\/tracks/)
    .times(times)
    .query((query) => {
      captured.push(query.songs as string);
      return true;
    })
    .reply(200);
  return { scope, captured };
};

// The playlist itself, not its tracks: the path ends at the id, so the match
// is a function rather than a loose regexp that /tracks would also satisfy.
const isPlaylistItself = (uri: string) => /^\/playlist\/\d+(\?|$)/.test(uri);

export const nockGetPlaylist = (response: Body = { id: 123456789, description: '' }) =>
  nock('https://api.deezer.com')
    .get(isPlaylistItself)
    .reply(200, response);

// Keeps the description the script wrote back
export const nockPostPlaylistDescriptionCapture = () => {
  const captured: { description?: string } = {};
  const scope = nock('https://api.deezer.com')
    .post(isPlaylistItself)
    .query((query) => {
      captured.description = query.description as string;
      return true;
    })
    .reply(200);
  return { scope, captured };
};
