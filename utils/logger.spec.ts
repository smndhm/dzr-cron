import nock from 'nock';
import setLogger, {
  getErrorCount,
  resetErrorCount,
  registerSecrets,
  forgetSecrets,
} from './logger';
import { getPlaylistTracks } from './dzr';

const accessToken = 'frblublublublublublublublublublublublublublublublu';
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';

const collect = () => {
  const lines: string[] = [];
  return { lines, output: (line: string) => lines.push(line) };
};

describe('Logger', () => {
  beforeEach(() => {
    resetErrorCount();
    forgetSecrets();
  });

  test('Should tag the line with its level and script', () => {
    const { lines, output } = collect();
    setLogger('my-script', output).info('Script started');

    expect(lines[0]).toContain('INFO [my-script] Script started');
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('Should keep the error message, stack and cause', () => {
    const { lines, output } = collect();
    const error = new Error('CRON_ARGUMENTS is not valid JSON.', {
      cause: new SyntaxError('Unexpected token } at position 42'),
    });

    setLogger('run-once', output).error(error);

    expect(lines[0]).toContain('CRON_ARGUMENTS is not valid JSON.');
    expect(lines[0]).toContain('Error: CRON_ARGUMENTS is not valid JSON.');
    expect(lines[0]).toContain('Caused by: SyntaxError: Unexpected token } at position 42');
  });

  test('Should log the detail given alongside a message', () => {
    const { lines, output } = collect();
    setLogger('last-tracks', output).error('API Error Response', { type: 'OAuthException', code: 300 });

    expect(lines[0]).toContain('API Error Response {"type":"OAuthException","code":300}');
  });

  test('Should redact every token of a playlists array', () => {
    const { lines, output } = collect();
    setLogger('last-tracks', output).info({
      playlists: [
        { access_token: accessToken, playlistId: 1234567890 },
        { access_token: otherAccessToken, playlistId: 9876543210 },
      ],
    });

    expect(lines[0]).not.toContain(accessToken);
    expect(lines[0]).not.toContain(otherAccessToken);
    expect(lines[0]).toContain('"playlistId":1234567890');
  });

  test('Should redact a token nested deeper in the payload', () => {
    const { lines, output } = collect();
    setLogger('run-once', output).info({
      cron: { action: 'last-tracks', arguments: { access_token: accessToken } },
    });

    expect(lines[0]).not.toContain(accessToken);
  });

  test('Should survive a circular payload', () => {
    const { lines, output } = collect();
    const payload: Record<string, unknown> = { access_token: accessToken };
    payload.self = payload;

    expect(() => setLogger('last-tracks', output).info(payload)).not.toThrow();
    expect(lines[0]).not.toContain(accessToken);
  });

  test('Should redact the token of a request that really failed', async () => {
    const { lines, output } = collect();
    registerSecrets([accessToken]);
    nock('https://api.deezer.com').get(/\/playlist\/\d+\/tracks/).times(1).reply(403, { error: 'nope' });

    try {
      await getPlaylistTracks(accessToken, 1234567890);
    } catch (e) {
      setLogger('last-tracks', output).error(e);
    }
    nock.cleanAll();

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(accessToken);
  });

  test('Should censor a registered token wherever it appears', () => {
    const { lines, output } = collect();
    registerSecrets([accessToken]);

    setLogger('last-tracks', output).info({
      url: `/playlist/1/tracks?access_token=${accessToken}&limit=2000`,
      nested: [{ trace: `token is ${accessToken}` }],
    });

    expect(lines[0]).not.toContain(accessToken);
    expect(lines[0]).toContain('[redacted]');
  });

  test('Should not censor a token too short to be one', () => {
    // Registering "a" would censor the letter a in every line
    const { lines, output } = collect();
    registerSecrets(['a']);

    setLogger('run-once', output).info({ cron: 'thibaut' });

    expect(lines[0]).toContain('"cron":"thibaut"');
  });

  test('Should forget the tokens between runs', () => {
    registerSecrets([accessToken]);
    forgetSecrets();
    const { lines, output } = collect();

    setLogger('last-tracks', output).info({ note: accessToken });

    expect(lines[0]).toContain(accessToken);
  });

  test('Should keep logging the playlist and track ids', () => {
    const { lines, output } = collect();
    setLogger('last-tracks', output).info({
      action: 'tracks-added',
      playlist: 1234567890,
      tracks: [1, 2, 3],
    });

    expect(lines[0]).toContain('{"action":"tracks-added","playlist":1234567890,"tracks":[1,2,3]}');
  });

  test('Should count the errors, not the infos', () => {
    const { output } = collect();
    const logger = setLogger('last-tracks', output);

    logger.info('Script started');
    logger.warn('No cron configured.');
    expect(getErrorCount()).toBe(0);

    logger.error('API Error Response');
    expect(getErrorCount()).toBe(1);

    resetErrorCount();
    expect(getErrorCount()).toBe(0);
  });

  test('Should count the errors across every script', () => {
    const { output } = collect();
    setLogger('last-tracks', output).error('first');
    setLogger('sync-playlists', output).error('second');

    expect(getErrorCount()).toBe(2);
  });
});
