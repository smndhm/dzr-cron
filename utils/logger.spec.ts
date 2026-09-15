import pino from 'pino';
import setLogger, { getErrorCount, resetErrorCount } from './logger';

const accessToken = 'frblublublublublublublublublublublublublublublublu';

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
  });

  test('Should tag the logs with the script name', () => {
    const { lines, destination } = collect();
    setLogger('my-script', destination).info('Script started');

    expect(lines[0].script).toBe('my-script');
    expect(lines[0].msg).toBe('Script started');
  });

  test('Should redact the access token of a failed request', () => {
    const { lines, destination } = collect();
    // Shape of an axios error: the token travels as a query parameter
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
