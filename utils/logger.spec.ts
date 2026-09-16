import pino from 'pino';
import nock from 'nock';
import setLogger, { getErrorCount, resetErrorCount, registerSecrets, forgetSecrets } from './logger';
import { getPlaylistTracks } from './dzr';

const accessToken = 'frblublublublublublublublublublublublublublublublu';
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';

const collect = () => {
  const lines: Record<string, unknown>[] = [];
  const destination = {
    write: (chunk: string) => {
      lines.push(JSON.parse(chunk));
    },
  } as unknown as pino.DestinationStream;
  return { lines, destination };
};

describe('Logger', () => {
  beforeEach(() => {
    resetErrorCount();
    forgetSecrets();
  });

  test('Should tag the logs with the script name', () => {
    const { lines, destination } = collect();
    setLogger('my-script', destination).info('Script started');

    expect(lines[0].script).toBe('my-script');
    expect(lines[0].msg).toBe('Script started');
  });

  test('Should redact the access token carried by an error', () => {
    const { lines, destination } = collect();
    // The token travels as a query parameter, so a client may keep it
    const error = Object.assign(new Error('Request failed with status code 403'), {
      config: {
        method: 'get',
        url: '/playlist/1234567890/tracks',
        params: { access_token: accessToken, limit: 2000 },
      },
    });

    setLogger('last-tracks', destination).error(error);

    expect(JSON.stringify(lines[0])).not.toContain(accessToken);
    expect(JSON.stringify(lines[0])).toContain('[redacted]');
  });

  test('Should redact every token of a playlists array', () => {
    const { lines, destination } = collect();
    setLogger('last-tracks', destination).info({
      playlists: [
        { access_token: accessToken, playlistId: 1234567890 },
        { access_token: otherAccessToken, playlistId: 9876543210 },
      ],
    });

    const line = JSON.stringify(lines[0]);
    expect(line).not.toContain(accessToken);
    expect(line).not.toContain(otherAccessToken);
    expect(lines[0].playlists).toEqual([
      { access_token: '[redacted]', playlistId: 1234567890 },
      { access_token: '[redacted]', playlistId: 9876543210 },
    ]);
  });

  test('Should redact a token nested deeper in the payload', () => {
    const { lines, destination } = collect();
    setLogger('run-once', destination).info({
      cron: { action: 'last-tracks', arguments: { access_token: accessToken } },
    });

    expect(JSON.stringify(lines[0])).not.toContain(accessToken);
  });

  test('Should keep the error message and stack', () => {
    const { lines, destination } = collect();
    setLogger('last-tracks', destination).error(new TypeError('Request failed with status code 403'));

    const { err } = lines[0] as { err: Record<string, unknown> };
    expect(err.message).toBe('Request failed with status code 403');
    // The class of the error is what the stack opens with
    expect(err.stack).toContain('TypeError: Request failed with status code 403');
  });

  test('Should survive the circular references of an axios error', () => {
    const { lines, destination } = collect();
    const error = Object.assign(new Error('socket hang up'), {
      config: { params: { access_token: accessToken } },
    }) as Error & { request?: unknown };
    error.request = error;

    expect(() => setLogger('last-tracks', destination).error(error)).not.toThrow();
    expect(JSON.stringify(lines[0])).not.toContain(accessToken);
  });

  test('Should redact the token of a request that really failed', async () => {
    // The synthetic error above is shaped by hand, this one is the real thing
    const { lines, destination } = collect();
    registerSecrets([accessToken]);
    nock('https://api.deezer.com').get(/\/playlist\/\d+\/tracks/).times(1).reply(403, { error: 'nope' });

    try {
      await getPlaylistTracks(accessToken, 1234567890);
    } catch (e) {
      setLogger('last-tracks', destination).error(e);
    }
    nock.cleanAll();

    expect(lines).toHaveLength(1);
    expect(JSON.stringify(lines[0])).not.toContain(accessToken);
  });

  test('Should censor a registered token wherever it appears', () => {
    const { lines, destination } = collect();
    registerSecrets([accessToken]);

    setLogger('last-tracks', destination).info({
      url: `/playlist/1/tracks?access_token=${accessToken}&limit=2000`,
      nested: [{ trace: `token is ${accessToken}` }],
    });

    const line = JSON.stringify(lines[0]);
    expect(line).not.toContain(accessToken);
    expect(line).toContain('[redacted]');
  });

  test('Should forget the tokens between runs', () => {
    registerSecrets([accessToken]);
    forgetSecrets();
    const { lines, destination } = collect();

    setLogger('last-tracks', destination).info({ note: accessToken });

    expect(JSON.stringify(lines[0])).toContain(accessToken);
  });

  test('Should redact an access token logged on its own', () => {
    const { lines, destination } = collect();
    setLogger('last-tracks', destination).info({ access_token: accessToken });

    expect(JSON.stringify(lines[0])).not.toContain(accessToken);
  });

  test('Should keep logging the playlist and track ids', () => {
    const { lines, destination } = collect();
    setLogger('last-tracks', destination).info({
      action: 'tracks-added',
      playlist: 1234567890,
      tracks: [1, 2, 3],
    });

    expect(lines[0].action).toBe('tracks-added');
    expect(lines[0].playlist).toBe(1234567890);
    expect(lines[0].tracks).toEqual([1, 2, 3]);
  });

  test('Should count the errors and the fatals, not the infos', () => {
    const { destination } = collect();
    const logger = setLogger('last-tracks', destination);

    logger.info('Script started');
    expect(getErrorCount()).toBe(0);

    logger.error('API Error Response');
    logger.fatal('Down');
    expect(getErrorCount()).toBe(2);

    resetErrorCount();
    expect(getErrorCount()).toBe(0);
  });

  test('Should count the errors across every script', () => {
    const { destination } = collect();
    setLogger('last-tracks', destination).error('first');
    setLogger('sync-playlists', destination).error('second');

    expect(getErrorCount()).toBe(2);
  });
});
