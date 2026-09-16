export interface Playlist {
    access_token: string,
    playlistId: number,
}

// A track as the Deezer API returns it, limited to the fields the scripts read
export interface DeezerTrack {
    id: number,
    title_short: string,
    duration: number,
    time_add: number,
    readable: boolean,
    explicit_lyrics: boolean,
    artist: { id: number },
    album: { id: number },
}

interface Cron {
    // Identifies the cron: this is how a workflow names the crons it runs
    name: string,
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