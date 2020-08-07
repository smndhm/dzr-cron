const nock = require("nock");
const mockEntityDeezerTracks = require("./api-deezer-tracks");

exports.nockUserMePermissions = (value = true) =>
  nock("https://api.deezer.com")
    .get(/\/user\/me\/permissions/)
    .reply(200, {
      permissions: {
        basic_access: value,
        offline_access: value,
        manage_library: value,
        delete_library: value,
      },
    });

exports.nockUserMeTracks = (response) =>
  nock("https://api.deezer.com")
    .get(/\/user\/me\/tracks/)
    .reply(200, response);

exports.nockGetPlaylistIdTracks = (times = 1, response) =>
  nock("https://api.deezer.com")
    .get(/\/playlist\/\d+\/tracks/)
    .times(times)
    .reply(
      200,
      response || {
        ...mockEntityDeezerTracks,
      }
    );

exports.nockDeletePlaylistIdTracks = () =>
  nock("https://api.deezer.com")
    .delete(/\/playlist\/\d+\/tracks/)
    .reply(200, true);

exports.nockPostPlaylistIdTracks = (times = 1) =>
  nock("https://api.deezer.com")
    .post(/\/playlist\/\d+\/tracks/)
    .times(times)
    .reply(200, true);

exports.cleanAll = () => nock.cleanAll();

exports.nockThrowError = (regexp) =>
  nock("https://api.deezer.com").get(regexp).replyWithError({
    message: "Error",
    code: 500,
  });

exports.nockRespondError = (regexp, times = 1) =>
  nock("https://api.deezer.com")
    .get(regexp)
    .times(times)
    .reply(200, { error: { type: "Error", message: "Error", code: 403 } });
