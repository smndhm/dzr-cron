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

export const postPlaylistTracksOrder = (access_token: string, playlistId: number, order: number[]) =>
  request('POST', `/playlist/${playlistId}/tracks`, { access_token, order: order.join(',') });
