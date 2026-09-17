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

// An artist as /user/me/artists returns it, limited to what the scripts read
export interface DeezerArtist {
    id: number,
    name: string,
}

// An album as /artist/{id}/albums returns it
export interface DeezerAlbum {
    id: number,
    title: string,
    release_date: string,
    record_type: string,
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

export interface NewReleasesCron extends Cron {
    action: 'new-releases',
    arguments: Playlist & {days?: number} & {recordTypes?: string[]}
}

export interface RemoveHeardCron extends Cron {
    action: 'remove-heard',
    arguments: Playlist,
}

export interface RemoveDuplicatesCron extends Cron {
    action: 'remove-duplicates',
    arguments: Playlist,
}

type AtLeastOne<T> = [T, ...T[]];
type AtLeastTwo<T> = [T, T, ...T[]];