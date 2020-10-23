// AXIOS PARAMS
const axios = require("axios");
axios.defaults.baseURL = "https://api.deezer.com";

const limit = 2000;

exports.getUserPermissions = async (access_token) => {
  const request = {
    method: "get",
    url: "/user/me/permissions",
    params: {
      access_token,
    },
  };
  const {
    data: { permissions },
  } = await axios(request);
  return permissions;
};

exports.getUserTracks = async (access_token) => {
  const request = {
    method: "get",
    url: "/user/me/tracks",
    params: {
      access_token,
      limit,
    },
  };
  const {
    data: { data },
  } = await axios(request);
  return data;
};

exports.getPlaylistTracks = async (access_token, playlistId) => {
  const request = {
    method: "get",
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      limit,
    },
  };
  const { data } = await axios(request);
  return data;
};

exports.deletePlaylistTracks = async (access_token, playlistId, songs) => {
  const request = {
    method: "delete",
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      songs,
    },
  };
  return await axios(request);
};

exports.postPlaylistTracks = async (access_token, playlistId, songs) => {
  const request = {
    method: "post",
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      songs,
    },
  };
  return await axios(request);
};

exports.postPlaylistTracksOrder = async (access_token, playlistId, order) => {
  const request = {
    method: "post",
    url: `/playlist/${playlistId}/tracks`,
    params: {
      access_token,
      order,
    },
  };
  return await axios(request);
};
