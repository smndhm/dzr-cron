import {
  LastTracksCron,
  SyncPlaylistCron,
  RemoveDuplicatesCron
} from './types';

// Check ./__mocks__/crons.conf.ts for exemples
const crons: (LastTracksCron|SyncPlaylistCron|RemoveDuplicatesCron)[] = [];

export default crons;