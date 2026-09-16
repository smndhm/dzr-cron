# Deezer Cron

Scripts to update my playlists

## Setup

The scripts run on GitHub Actions, scheduled by the workflows in `.github/workflows`. There is nothing to install: the only setup is the configuration, and it lives in a repository secret because it holds Deezer access tokens.

### Configure the crons in the `CRONS_CONF` secret

`Settings` > `Secrets and variables` > `Actions` > `New repository secret`, named `CRONS_CONF`, holding a JSON array of crons. Each cron has the following structure:

```json
{
  "name": "kids-playlist",
  "action": "sync-playlists",
  "arguments": []
}
```

- `name` identifies the cron, and must be unique: this is how a workflow names the crons it runs.
- `action` is the script to launch, can be "last-tracks", "sync-playlists" or "remove-duplicates".
- `arguments` are the arguments passed to the script, and depend on the action. See below.

The whole secret is validated before any call to Deezer: a missing or malformed field fails the run immediately, and the error never contains a token.

### Schedule them in a workflow

Each cadence is a workflow of its own, naming the crons it runs. `crons-hourly.yml` and `crons-daily.yml` are there to be edited; `crons.yml` holds the steps they share and never runs on its own.

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

Adding a new rhythm means adding one such file. A name that no cron in the secret answers to fails the run, rather than quietly doing nothing.

If every cron shares the same cadence, drop the `names` line and keep a single workflow: with no name given it runs them all, and there is no list to keep in sync with the secret.

## Scripts

### Last playlist tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Structure in the `CRONS_CONF` secret

```json
{
  "name": "car-playlist",
  "action": "last-tracks",
  "arguments": {
    "access_token": "frblublublublublublublublublublublublublublublublu",
    "playlistId": 1234567890,
    "playlists": [
      { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1111111111 },
      { "access_token": "frblablablablablablablablablablablablablablablabla", "playlistId": 9876543210 }
    ],
    "nbTracks": 10,
    "noExplicitLyrics": true
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

#### Structure in the `CRONS_CONF` secret

```json
{
  "name": "kids-playlist",
  "action": "sync-playlists",
  "arguments": [
    { "access_token": "frblublublublublublublublublublublublublublublublu", "playlistId": 1234567890 },
    { "access_token": "frblablablablablablablablablablablablablablablabla", "playlistId": 9876543210 }
  ]
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

#### Structure in the `CRONS_CONF` secret

```json
{
  "name": "remove-duplicates",
  "action": "remove-duplicates",
  "arguments": {
    "access_token": "frblublublublublublublublublublublublublublublublu",
    "playlistId": 1234567890
  }
}
```

#### Arguments

Must be an objects with the following properties:

- `access_token` is your Deezer user token allowing the script to perform actions on your library. Needs `offline_access`, `manage_library` and `delete_library` permissions.  
  See how to get an access_token on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).
- `playlistId` is the playlist ID you want to synchonize. Must belong to the access_token account.

## Running

The workflows run on their own once the `CRONS_CONF` secret is set. `Run workflow` on the Actions tab runs a cadence by hand, outside of its schedule.

`npm run cron:once` is the command they run. It reads the configuration from the `CRONS_CONF` environment variable, and `CRON_NAMES` restricts it to a comma separated list of crons. Handy to check a token from a terminal without waiting for a schedule.

### Good to know

- GitHub evaluates the workflow schedules in UTC and does not know about daylight saving, so the daily run drifts by an hour between summer and winter. It fires in the early morning, where it does not matter.
- GitHub's scheduler is best effort and can be delayed by 10 to 30 minutes. Every script is idempotent, so a late or repeated run is harmless.
- A scheduled workflow is automatically disabled after 60 days without activity in the repository.
- Actions logs are public on a public repository, and a failed Deezer request carries the `access_token` in its axios error. Each token is therefore registered with `::add-mask::` before anything else runs, and the logger censors every `access_token` it is given, at any depth.
- The job turns red as soon as a script logs an error, so a revoked token does not fail silently day after day.

## TODO

- [ ] Check API quota limit with multiples crons
- [x] Better logs
- [x] Add cron script to check and remove track if already exist
- [x] Edit last-tracks cron to be able to set a specific playlist
- [x] Tests
- [x] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
