# Deezer Cron

Scripts to update my playlists

## Setup

The scripts run on GitHub Actions, scheduled by the workflows in `.github/workflows`. There is nothing to install. The setup is in two parts: the crons themselves, versioned in `crons.conf.json`, and the Deezer access tokens, which are secrets.

### Configure the crons in `crons.conf.json`

A JSON array of crons, committed with the code so its history is readable. Each cron has the following structure:

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

The file is validated before any call to Deezer: a missing or malformed field fails the run immediately.

### Put the tokens in secrets

The file holds no token. Wherever one is needed it names the secret carrying it, as `$MY_ACCESS_TOKEN`, and the run fills it in. A literal token is rejected by the validation, so one cannot be committed here by mistake.

Each name is a repository secret, added under `Settings` > `Secrets and variables` > `Actions` > `New repository secret`, and passed to the job by `crons.yml`. Adding a token means adding a secret and the matching line in that workflow. A placeholder with no secret behind it fails the run, naming the secret and never its value.

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

Adding a new rhythm means adding one such file. A name that no cron in `crons.conf.json` answers to fails the run, rather than quietly doing nothing.

If every cron shares the same cadence, drop the `names` line and keep a single workflow: with no name given it runs them all, and there is no list to keep in sync with the secret.

## Scripts

### Last playlist tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Structure in `crons.conf.json`

```json
{
  "name": "car-playlist",
  "action": "last-tracks",
  "arguments": {
    "access_token": "$MY_ACCESS_TOKEN",
    "playlistId": 1234567890,
    "playlists": [
      { "access_token": "$MY_ACCESS_TOKEN", "playlistId": 1111111111 },
      { "access_token": "$OTHER_ACCESS_TOKEN", "playlistId": 9876543210 }
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

#### Structure in `crons.conf.json`

```json
{
  "name": "kids-playlist",
  "action": "sync-playlists",
  "arguments": [
    { "access_token": "$MY_ACCESS_TOKEN", "playlistId": 1234567890 },
    { "access_token": "$OTHER_ACCESS_TOKEN", "playlistId": 9876543210 }
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

#### Structure in `crons.conf.json`

```json
{
  "name": "remove-duplicates",
  "action": "remove-duplicates",
  "arguments": {
    "access_token": "$MY_ACCESS_TOKEN",
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

The workflows run on their own once the token secrets are set. `Run workflow` on the Actions tab runs a cadence by hand, outside of its schedule.

`pnpm cron:once` is the command they run. It reads `crons.conf.json`, takes the tokens from the environment, and `CRON_NAMES` restricts it to a comma separated list of crons. Handy to check a token from a terminal without waiting for a schedule.

The other scripts are `pnpm test`, `pnpm lint` and `pnpm typecheck`, which the `Tests` workflow runs on every push and pull request. Nothing is type checked at run time: the crons are executed by `tsx`, so a type error fails the build rather than a nightly run.

### Good to know

- GitHub evaluates the workflow schedules in UTC and does not know about daylight saving, so the daily run drifts by an hour between summer and winter. It fires in the early morning, where it does not matter.
- GitHub's scheduler is best effort and can be delayed by 10 to 30 minutes. Every script is idempotent, so a late or repeated run is harmless.
- A scheduled workflow is automatically disabled after 60 days without activity in the repository.
- Actions logs are public on a public repository, and a failed Deezer request carries the `access_token` in a dozen places: the axios error keeps it under `params`, but also inside every url it held on to. Three layers answer for it: GitHub masks the secrets it hands to the job, the run registers them again with `::add-mask::`, and the logger censors them itself — by key, and by value wherever a token appears in a string, so a url leaks nothing either.
- The logs also carry the playlist and track ids of what each run changed, which is public on a public repository.
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
