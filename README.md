# Deezer Cron

Scripts to update my playlists

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure crons in `crons.conf.js` file

This file exports an array of crons, each cron has the following structure:

```typescript
{
  name,
  refreshInterval,
  action,
  arguments,
}
```

- `name` identifies the cron. It must be unique: this is how the GitHub workflows pick the crons they run.
- `refreshInterval` is the cron schedule expression, see: https://crontab.guru/. Optional, and only used by `npm run start`: on GitHub Actions the workflow carries the schedule.
- `action` is the script to launch, can be "last-tracks", "sync-playlists" or "remove-duplicates".
- `arguments` is the list of arguments to pass to the script, depends on the cron.

## Scripts

### Last playlist tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Structure for the `cron.conf.js` file

```typescript
{
  name: "car-playlist",
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
  name: "kids-playlist",
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
  name: "remove-duplicates",
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

`npm run start` keeps a process alive and fires each cron on its own `refreshInterval`. Crons without one are skipped, since they are scheduled by a workflow.

### On GitHub Actions

The schedules live in the workflows, one file per cadence: `.github/workflows/crons-hourly.yml` and `crons-daily.yml`. Each one says when it fires and which crons it runs, by name:

```yaml
on:
  schedule:
    - cron: '17 3 * * *'

jobs:
  run:
    uses: ./.github/workflows/crons.yml
    with:
      names: car-playlist,remove-duplicates
    secrets: inherit
```

`crons.yml` holds the steps shared by every cadence and never runs on its own. Adding a new rhythm means adding one such file, not a new script. A name that no cron in the configuration answers to fails the run, rather than quietly doing nothing.

`refreshInterval` is ignored here: on Actions the workflow is the schedule. It only matters for `npm run start`.

#### Configuration

The configuration holds Deezer access tokens, so it cannot live in the committed `crons.conf.ts`. Store it in a repository secret named `CRONS_CONF` (`Settings` > `Secrets and variables` > `Actions` > `New repository secret`), holding the same array as the configuration file, as JSON:

```json
[
  {
    "name": "kids-playlist",
    "action": "sync-playlists",
    "arguments": [
      { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1234567890 },
      { "access_token": "frblablablablablablablablablablablablablablablabla", "playlistId": 9876543210 }
    ]
  },
  {
    "name": "remove-duplicates",
    "action": "remove-duplicates",
    "arguments": { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1234567890 }
  }
]
```

When `CRONS_CONF` is unset, `crons.conf.ts` is used instead, so nothing changes locally. The configuration is validated before any call to Deezer: a missing or malformed field fails the run immediately, and the error never contains a token.

#### Good to know

- GitHub evaluates the workflow schedules in UTC and does not know about daylight saving, so the daily run drifts by an hour between summer and winter. It fires in the early morning, where it does not matter.
- GitHub's scheduler is best effort and can be delayed by 10 to 30 minutes. Every script is idempotent, so a late or repeated run is harmless.
- A scheduled workflow is automatically disabled after 60 days without activity in the repository.
- Actions logs are public on a public repository, and a failed Deezer request carries the `access_token` in its axios error. Each token is therefore registered with `::add-mask::` before anything else runs, and the logger censors every `access_token` it is given, at any depth.
- The job turns red as soon as a script logs an error, so a revoked token does not fail silently day after day.
- `Run workflow` on the Actions tab runs a cadence by hand, outside of its schedule.

## TODO

- [ ] Check API quota limit with multiples crons
- [x] Better logs
- [x] Add cron script to check and remove track if already exist
- [x] Edit last-tracks cron to be able to set a specific playlist
- [x] Tests
- [x] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
