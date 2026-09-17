// Deezer API
const BASE_URL = 'https://api.deezer.com';

const limit = 2000;

type Params = Record<string, string | number>;

// Deezer answers 200 with an `error` payload for its own errors, so only a
// transport or status failure is thrown from here.
const request = async (method: string, path: string, params: Params) => {
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, { method });
  if (!response.ok) {
    throw new Error(`Deezer answered ${response.status} ${response.statusText}.`);
  }

  // The write endpoints can answer with an empty body
  const body = await response.text();
  return body ? JSON.parse(body) : undefined;
};

export const getPlaylistTracks = (access_token: string, playlistId: number) =>
  request('GET', `/playlist/${playlistId}/tracks`, { access_token, limit });

export const deletePlaylistTracks = (access_token: string, playlistId: number, songs: number[]) =>
  request('DELETE', `/playlist/${playlistId}/tracks`, { access_token, songs: songs.join(',') });

export const postPlaylistTracks = (access_token: string, playlistId: number, songs: number[]) =>
  request('POST', `/playlist/${playlistId}/tracks`, { access_token, songs: songs.join(',') });

// The artists the user has put in their favourites
export const getFavouriteArtists = (access_token: string) =>
  request('GET', '/user/me/artists', { access_token, limit });

// Deezer answers a list of calls in one request. This is what makes a cron
// over every favourite artist affordable: fifty artists in one call rather
// than one call each. The answer is { batch_result: [...] }, in the order the
// calls were given.
export const getBatch = (access_token: string, relativeUrls: string[]) =>
  request('GET', '/batch', {
    access_token,
    methods: JSON.stringify(
      relativeUrls.map((relative_url) => ({ relative_url, params: { limit } })),
    ),
  });

export const postPlaylistTracksOrder = (access_token: string, playlistId: number, order: number[]) =>
  request('POST', `/playlist/${playlistId}/tracks`, { access_token, order: order.join(',') });
