import removeHeard from './remove-heard';
import {
  cleanAll,
  nockGetPlaylistIdTracks,
  nockGetListeningHistory,
  nockGetListeningHistoryPages,
  nockDeletePlaylistIdTracksCapture,
  nockRespondError,
} from '../utils/nocks';

const holding = (...ids: number[]) =>
  nockGetPlaylistIdTracks(1, { data: ids.map((id) => ({ id })) });
const played = (...ids: number[]) =>
  nockGetListeningHistory({ data: ids.map((id) => ({ id })) });

const args = { access_token: 'token', playlistId: 123456789 };

describe('remove-heard', () => {
  afterEach(() => {
    cleanAll();
  });

  test('removes the tracks that have been played', async () => {
    holding(101, 102, 103);
    played(102, 103, 999);
    const { scope, captured } = nockDeletePlaylistIdTracksCapture();

    await removeHeard(args);

    expect(scope.isDone()).toBeTruthy();
    expect(captured.songs).toBe('102,103');
  });

  test('leaves a track nobody has played', async () => {
    holding(101);
    played(999);
    const { scope } = nockDeletePlaylistIdTracksCapture();

    await removeHeard(args);

    expect(scope.isDone()).toBeFalsy();
  });

  test('does not read the history for an empty playlist', async () => {
    holding();
    const history = nockGetListeningHistory();

    await removeHeard(args);

    expect(history.isDone()).toBeFalsy();
  });

  test('removes nothing when the history cannot be read', async () => {
    holding(101);
    nockRespondError(/\/user\/me\/history/);
    const { scope } = nockDeletePlaylistIdTracksCapture();

    await removeHeard(args);

    expect(scope.isDone()).toBeFalsy();
  });

  test('walks every page of the history, not just the first fifty', async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => ({ id: 1000 + i }));
    const secondPage = [{ id: 777 }];
    holding(777);
    const { scope, indexes } = nockGetListeningHistoryPages(firstPage, secondPage);
    const remove = nockDeletePlaylistIdTracksCapture();

    await removeHeard(args);

    expect(scope.isDone()).toBeTruthy();
    expect(indexes).toEqual(['0', '50']);
    // 777 only appears on the second page, so a single page would have kept it
    expect(remove.captured.songs).toBe('777');
  });

  test('reports an error rather than throwing when the playlist cannot be read', async () => {
    nockRespondError(/\/playlist\/\d+\/tracks/);
    const { scope } = nockDeletePlaylistIdTracksCapture();

    await removeHeard(args);

    expect(scope.isDone()).toBeFalsy();
  });
});
