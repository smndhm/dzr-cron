// AXIOS PARAMS
import axios, { AxiosRequestConfig } from 'axios';

axios.defaults.baseURL = 'https://api.deezer.com';

const limit = 2000;

export const getPlaylistTracks = async (access_token: string, playlistId: number) => {
  const request:AxiosRequestConfig = {
    method: 'get',
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      limit,
    },
  };
  const { data } = await axios(request);
  return data;
};

export const deletePlaylistTracks = async (access_token: string, playlistId: number, songs: number[]) => {
  const request: AxiosRequestConfig = {
    method: 'delete',
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      songs: songs.join(','),
    },
  };
  return await axios(request);
};

export const postPlaylistTracks = async (access_token: string, playlistId: number, songs: number[]) => {
  const request: AxiosRequestConfig = {
    method: 'post',
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      songs: songs.join(','),
    },
  };
  return await axios(request);
};

export const postPlaylistTracksOrder = async (access_token: string, playlistId: number, order: number[]) => {
  const request: AxiosRequestConfig = {
    method: 'post',
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      order: order.join(','),
    },
  };
  return await axios(request);
};

