// Deezer API
const BASE_URL = 'https://api.deezer.com';

const limit = 2000;

type Params = Record<string, string | number>;

// Deezer takes more than fifteen seconds over a batch of fifty artists often
// enough to answer 504: nine runs in a hundred died that way. These statuses,
// and a connection that drops, say nothing about the request itself, so it is
// sent again. Once only — a gateway that times out twice in a second is not
// going to answer on the third try, and the next run is four hours away with
// the mark holding its place, which is the real second chance.
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 2;

// Tests set it to nothing rather than wait
const retryDelay = (env: NodeJS.ProcessEnv = process.env): number =>
  Number(env.DZR_RETRY_DELAY_MS ?? 1000);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Thrown where the caller may decide to carry on without this answer, which no
// other failure allows: a refused token has to stop the run.
export class TransientError extends Error {}

// Deezer answers 200 with an `error` payload for its own errors, so only a
// transport or status failure is thrown from here.
const request = async (method: string, path: string, params: Params) => {
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  for (let attempt = 1; ; attempt += 1) {
    const last = attempt === ATTEMPTS;
    let response: Response;
    try {
      response = await fetch(url, { method });
    } catch (e) {
      if (last) {
        throw new TransientError(`Deezer could not be reached: ${String(e)}`);
      }
      await pause(retryDelay());
      continue;
    }

    if (TRANSIENT.has(response.status)) {
      if (last) {
        throw new TransientError(
          `Deezer answered ${response.status} ${response.statusText}, twice.`,
        );
      }
      await pause(retryDelay());
      continue;
    }
    if (!response.ok) {
      throw new Error(`Deezer answered ${response.status} ${response.statusText}.`);
    }

    // The write endpoints can answer with an empty body
    const body = await response.text();
    return body ? JSON.parse(body) : undefined;
  }
};

export const getPlaylistTracks = (access_token: string, playlistId: number) =>
  request('GET', `/playlist/${playlistId}/tracks`, { access_token, limit });

// The songs travel in the url, so writes split rather than find where Deezer
// stops reading one. Here rather than in each caller: the api imposes it.
const SONGS_PER_CALL = 100;

const writeSongs = async (
  method: string,
  access_token: string,
  playlistId: number,
  songs: number[],
) => {
  for (let i = 0; i < songs.length; i += SONGS_PER_CALL) {
    await request(method, `/playlist/${playlistId}/tracks`, {
      access_token,
      songs: songs.slice(i, i + SONGS_PER_CALL).join(','),
    });
  }
};

export const deletePlaylistTracks = (access_token: string, playlistId: number, songs: number[]) =>
  writeSongs('DELETE', access_token, playlistId, songs);

export const postPlaylistTracks = (access_token: string, playlistId: number, songs: number[]) =>
  writeSongs('POST', access_token, playlistId, songs);

// The playlist itself rather than its tracks, for its description
export const getPlaylist = (access_token: string, playlistId: number) =>
  request('GET', `/playlist/${playlistId}`, { access_token });

export const postPlaylistDescription = (
  access_token: string,
  playlistId: number,
  description: string,
) => request('POST', `/playlist/${playlistId}`, { access_token, description });

// The artists the user has put in their favourites
export const getFavouriteArtists = (access_token: string) =>
  request('GET', '/user/me/artists', { access_token, limit });

// What the user has listened to lately, most recent first. Needs the
// listening_history permission, and ignores limit: Deezer answers fifty at a
// time under a total, so every page is read rather than only the first.
const HISTORY_PAGE = 50;
// A history long enough to need this many pages is one nobody listens to
const HISTORY_PAGES = 40;

export const getListeningHistory = async (access_token: string) => {
  const data: unknown[] = [];

  for (let page = 0; page < HISTORY_PAGES; page += 1) {
    const answer = await request('GET', '/user/me/history', {
      access_token,
      index: page * HISTORY_PAGE,
    });
    // Let the caller report it, as it would for a single call
    if (answer?.error) {
      return answer;
    }
    const read = answer?.data ?? [];
    data.push(...read);
    if (read.length < HISTORY_PAGE || data.length >= (answer?.total ?? data.length)) {
      break;
    }
  }

  return { data };
};

// Fifty calls in one request, which is what makes a sweep over every favourite
// artist affordable. Answers { batch_result: [...] } in the order given.
export const getBatch = (access_token: string, relativeUrls: string[]) =>
  request('GET', '/batch', {
    access_token,
    methods: JSON.stringify(
      relativeUrls.map((relative_url) => ({ relative_url, params: { limit } })),
    ),
  });

export const postPlaylistTracksOrder = (access_token: string, playlistId: number, order: number[]) =>
  request('POST', `/playlist/${playlistId}/tracks`, { access_token, order: order.join(',') });
