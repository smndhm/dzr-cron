# Deezer Cron

Scripts to update my playlists

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure crons in `crons.conf.js` file

This file exports an array of crons, each cron has the following structure:

```typescript
{
  refreshInterval,
  action,
  arguments,
}
```

- `refreshInterval` is the cron schedule expression, see: https://crontab.guru/.
- `action` is the script to launch, can be "last-tracks", "sync-playlists" or "remove-duplicates".
- `arguments` is the list of arguments to pass to the script, depends on the cron.

## Scripts

### Last playlist tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Structure for the `cron.conf.js` file

```typescript
{
  refreshInterval: "0 * * * *",
  action: "last-tracks",
  arguments: {
    playlists : [
      {
        access_token: "frblublublublublublublublublublublublublublublublu",
        playlistId: 1234567890
      },
      {
        access_token: "frblablablablablablablablablablablablablablablabla",
        playlistId: 9876543210
      }
    ],
    nbTracks: 10,
    noExplicitLyrics: true,
  }
}
```

#### Arguments

- `playlists` is an array of objects with the following properties:

  - `playlistId` is the playlist ID you want to synchonize. Must belong to the access_token account.
  - `access_token` is your Deezer user token allowing the script to perform actions on your library. Needs `offline_access`, `manage_library` and `delete_library` permissions.

    See how to get an access_token on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).

- `nbTracks` is the number of tracks you want to import from each playlists.
- `noExplicitLyrics` if you don't want tracks with explicit lyrics. Optional, default is false.

### Synchonize playlists

What happened, Lucas had its playlist on my account, I was adding tracks for him and then, one day, he went to see mom... _"What! You don't have my playlist?"_  
So I set the playlist public, mom added the playlist to its favorites, Lucas listens to its tracks... _"What! Can't you add tracks?"_  
I didn't set the playlist collaborative, mom created a new playlist, added tracks, Lucas went back to dad... _"What! You don't have my last tracks?"_  
Ok, new cron.

#### Structure for the `cron.conf.js` file

```typescript
{
  refreshInterval: "0 * * * *",
    action: "sync-playlists",
    arguments: [
      {
        access_token: "frblublublublublublublublublublublublublublublublu",
        playlistId: 1234567890
      },
      {
        access_token: "frblablablablablablablablablablablablablablablabla",
        playlistId: 9876543210
      }
    ],
}
```

#### Arguments

Must be an array of objects with the following properties:

- `access_token` is your Deezer user token allowing the script to perform actions on your library. Needs `offline_access`, `manage_library` and `delete_library` permissions.  
  See how to get an access_token on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).
- `playlistId` is the playlist ID you want to synchonize. Must belong to the access_token account.

### Remove duplicates

I have a lot of titles in my favorite playlist and I realized that there could be the same track several times, this is often due to a track present in an album and in an EP, an album that has been reissued, etc. New cron.  
This will delete last duplicate added track.

#### Structure for the `cron.conf.js` file

```typescript
{
  refreshInterval: "0 0 * * *",
    action: "remove-duplicates",
    arguments: {
        access_token: "frblublublublublublublublublublublublublublublublu",
        playlistId: 1234567890
      },
    ],
}
```

#### Arguments

Must be an objects with the following properties:

- `access_token` is your Deezer user token allowing the script to perform actions on your library. Needs `offline_access`, `manage_library` and `delete_library` permissions.  
  See how to get an access_token on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).
- `playlistId` is the playlist ID you want to synchonize. Must belong to the access_token account.

## Launch

### Locally

`npm run start` keeps a process alive and fires each cron on its own `refreshInterval`.

### On GitHub Actions

The `Deezer crons` workflow wakes up every hour and runs `npm run cron:once`, which only runs the crons that were due since the previous wake up. `refreshInterval` stays the single source of truth, so the same configuration drives both ways of running the scripts.

#### Configuration

The configuration holds Deezer access tokens, so it cannot live in the committed `crons.conf.ts`. Store it in a repository secret named `CRONS_CONF` (`Settings` > `Secrets and variables` > `Actions` > `New repository secret`), holding the same array as the configuration file, as JSON:

```json
[
  {
    "refreshInterval": "0 * * * *",
    "action": "sync-playlists",
    "arguments": [
      { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1234567890 },
      { "access_token": "frblablablablablablablablablablablablablablablabla", "playlistId": 9876543210 }
    ]
  },
  {
    "refreshInterval": "0 0 * * *",
    "action": "remove-duplicates",
    "arguments": { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1234567890 }
  }
]
```

When `CRONS_CONF` is unset, `crons.conf.ts` is used instead, so nothing changes locally. The configuration is validated before any call to Deezer: a missing or malformed field fails the run immediately, and the error never contains a token.

#### Good to know

- GitHub evaluates the workflow schedule in UTC, but `refreshInterval` is still evaluated in `Europe/Paris`, daylight saving included.
- GitHub's scheduler is best effort and can be delayed by 10 to 30 minutes. At the edge of the window a cron can therefore run twice, or be skipped. Every script is idempotent, so this is harmless. `CRON_WINDOW_MINUTES` widens the window if needed (60 minutes by default).
- A scheduled workflow is automatically disabled after 60 days without activity in the repository.
- Actions logs are public on a public repository, and a failed Deezer request carries the `access_token` in its axios error. Each token is therefore registered with `::add-mask::` before anything else runs, and the logger redacts every `access_token` it is given.
- The job turns red as soon as a script logs an error, so a revoked token does not fail silently hour after hour.
- `Run workflow` on the Actions tab triggers a run by hand. Tick `run_all` to run every cron whatever its `refreshInterval`.

## TODO

- [ ] Check API quota limit with multiples crons
- [x] Better logs
- [x] Add cron script to check and remove track if already exist
- [x] Edit last-tracks cron to be able to set a specific playlist
- [x] Tests
- [x] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
