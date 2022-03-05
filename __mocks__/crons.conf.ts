import { LastTracksCron, SyncPlaylistCron, RemoveDuplicatesCron } from '../types';
const myAccessToken = 'frblublublublublublublublublublublublublublublublu';
const myPlaylistId = 1234567890;
const mySecondPlaylistId = 9876543210;
const otherAccessToken = 'frblablablablablablablablablablablablablablablabla';
const otherPlaylistId = 9876543210;

const crons: (LastTracksCron|SyncPlaylistCron|RemoveDuplicatesCron)[] = [
  {
    // Car offline playlist
    refreshInterval: '0 0 * * *', // Every day
    action: 'last-tracks',
    arguments: {
      access_token: myAccessToken,
      playlistId: mySecondPlaylistId,
      playlists: [
        {
          access_token: myAccessToken,
          playlistId: myPlaylistId,
        },
        {
          access_token: otherAccessToken,
          playlistId: otherPlaylistId,
        },
      ],
      nbTracks: 10,
    },
  },
  {
    // Kid playlist
    refreshInterval: '0 * * * *', // Every hour
    action: 'sync-playlists',
    arguments: [
      {
        access_token: myAccessToken,
        playlistId: myPlaylistId,
      },
      {
        access_token: otherAccessToken,
        playlistId: otherPlaylistId,
      },
    ],
  },
  {
    // remove duplicates
    refreshInterval: '0 0 * * *', // Every day
    action: 'remove-duplicates',
    arguments: {
      access_token: myAccessToken,
      playlistId: myPlaylistId,
    },
  },
  
];

export default crons;