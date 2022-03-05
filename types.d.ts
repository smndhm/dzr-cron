export interface Playlist {
    access_token: string,
    playlistId: number,
}

interface Cron {
    refreshInterval: string,
}

export interface LastTracksCron extends Cron {
    action: 'last-tracks',
    arguments: Playlist & {playlists: AtLeastOne<Playlist>} & {nbTracks?: number} & {noExplicitLyrics?: boolean}
}

export interface SyncPlaylistCron extends Cron {
    action: 'sync-playlists',
    arguments: AtLeastTwo<Playlist>,
}

export interface RemoveDuplicatesCron extends Cron {
    action: 'remove-duplicates',
    arguments: Playlist,
}

type AtLeastOne<T> = [T, ...T[]];
type AtLeastTwo<T> = [T, T, ...T[]];