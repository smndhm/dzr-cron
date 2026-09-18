# Deezer Cron

Scripts to update my playlists

## Setup

The scripts run on GitHub Actions. There is nothing to install. The setup is in two parts: one workflow per cron in `.github/workflows`, which says when it runs and what it does, and the Deezer access tokens, which are secrets.

### Define each cron in its own workflow

A cron is one file in `.github/workflows`, named after it, holding everything about it: when it runs, what it does, and on which playlists.

```yaml
name: Cron thibaut

on:
  schedule:
    - cron: '53 * * * *'
  workflow_dispatch:

concurrency:
  group: dzr-crons
  cancel-in-progress: false

jobs:
  run:
    uses: ./.github/workflows/crons.yml
    with:
      cron: thibaut
      action: sync-playlists
      arguments: |
        [
          { "access_token": "$MY_ACCESS_TOKEN", "playlistId": 1008179901 },
          { "access_token": "$LYNDS_ACCESS_TOKEN", "playlistId": 3143324282 }
        ]
    secrets: inherit
```

- `cron` names it in the logs.
- `action` is the script to launch, one of "last-tracks", "sync-playlists" or "remove-duplicates".
- `arguments` are the arguments of that action, as JSON. They depend on the action, see below.

`crons.yml` holds the steps every cron shares and never runs on its own. Adding a cron means adding one such file, and nothing else.

One file per cron rather than a central configuration, because the Actions tab then reads as a dashboard: each cron has its own name, its own green or red history, and its own button to run it by hand, and a failing one only reddens itself. The shared concurrency group keeps them from overlapping, since several read a playlist another one writes, and their minutes are staggered so they do not queue behind one another.

Everything is validated before any call to Deezer: a missing or malformed field fails the run immediately.

### Put the tokens in secrets

The workflows hold no token. Wherever one is needed they name the secret carrying it, as `$MY_ACCESS_TOKEN`, and the run fills it in. A literal token is rejected by the validation, so one cannot be committed here by mistake.

Each name is a repository secret, added under `Settings` > `Secrets and variables` > `Actions` > `New repository secret`, and passed to the job by `crons.yml`. Adding a token means adding a secret and the matching line in that workflow. A placeholder with no secret behind it fails the run, naming the secret and never its value.

### Getting one

Deezer app `414442`, registered on the `github.io` domain. Permissions are asked
for at authorization rather than configured on the app, so widening them means
authorizing again rather than registering anything new.

Open this, and check the consent screen lists what you expect:

```
https://connect.deezer.com/oauth/auth.php?app_id=414442
  &redirect_uri=https%3A%2F%2Fsmndhm.github.io%2Fdzr-cron%2F
  &perms=offline_access,manage_library,delete_library,listening_history
```

It lands on a 404, which is fine: Pages is off for this repository and the code
is in the address bar, as `?code=...`. Exchange it, with the secret from the
app's page:

```sh
curl -s "https://connect.deezer.com/oauth/access_token.php?app_id=414442&secret=SECRET&code=CODE&output=json"
```

`{"access_token":"fr...","expires":0}` — the zero is `offline_access` being
granted, which is why these tokens outlive everything else here. The code is
good once and for a few minutes; a failed exchange means starting at the
authorization again rather than retrying.

The browser step cannot be replaced by a request: it is where Deezer shows you
what is being asked for. The rest is one call.

## Scripts

### Last playlist tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Arguments of the action

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

#### Arguments of the action

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

### New releases

I follow a few hundred artists and I miss what they put out, because a release
shows up in an app I open when I think of it. This cron reads every artist in my
favourites, keeps what they released in the last few days, and pours the tracks
into one playlist. Nothing is ever removed from it, so a release waits there
until I have played it.

Asking Deezer once per artist would be a few hundred requests. The `batch`
endpoint answers fifty calls at a time, so a run costs about a dozen.

#### Arguments of the action

```json
{
  "name": "new-releases",
  "action": "new-releases",
  "arguments": {
    "access_token": "$MY_ACCESS_TOKEN",
    "playlistId": 1234567890,
    "days": 15,
    "recordTypes": ["album", "ep", "single"]
  }
}
```

#### Arguments

Must be an object with the following properties:

- `access_token` is your Deezer user token. Needs `listening_history` on top of
  what the other crons ask for, and reads your favourite artists.
- `playlistId` is the playlist the releases are poured into. Must belong to the
  access_token account.
- `days` is how far back a release is still considered new, and it is only used
  on a playlist the cron has never touched — after that the mark in the
  description says where to start. Optional, default 15. It only decides what
  the cron looks at: nothing expires out of the playlist, so a wider window
  costs a bigger first run and buys tolerance for the days the scheduler stays
  silent.
- `recordTypes` keeps only those kinds of release, among `album`, `compile`,
  `ep` and `single`. Optional, everything by default. `compile` is where
  reissues and best-of live, which are new releases of old music.

#### The mark in the description

A cron that never removes anything still has to know what it has already seen,
and the playlist forgets a track the moment something takes it out. So each run
writes down the day it covered, at the end of the playlist description:

```
Mes sorties [dzr-cron:2026-09-17]
```

The next run starts there rather than from `days`, which is what keeps a track
you have played from being poured back in later. It is a date rather than a list
of ids on purpose: ten characters instead of ten per track, and it cannot
outgrow the field. Whatever you wrote in the description is kept, and the mark
is replaced rather than stacked.

A run reads slightly further back than the day it wrote down, because Deezer
sometimes publishes a release after its own `release_date`. And a run that could
not read every artist leaves the previous mark alone, rather than claiming to
have covered artists it never saw.

#### A release that is not out yet

Deezer lists an album before it comes out, and most of its tracks do not play
until the day it does — but not all of them: a single is often out weeks before
the album it sits on. Dropping everything dated after today would miss it, and
pouring the whole album in early would fill the playlist with tracks nobody can
listen to.

So an album dated after today is kept, and its tracks are filtered on whether
Deezer says they can be played. That filter is trusted here and nowhere else,
because here being wrong repairs itself: the mark a run leaves can never reach a
date that has not come, so the album is still inside the window on its release
day and whatever was held back is poured in then.

On an album already out, the same filter would be final — the mark moves past
it, nothing looks again — so a track Deezer calls unplayable today is added
anyway. Losing it for good is worse than carrying it.

That rule earns its keep every Friday. Albums come out at midnight local time,
which is 22:00 UTC the day before in summer and 23:00 in winter, and Friday is
release day — Thursday for singles. So a Friday album is on Deezer while this
cron, which counts days in UTC, still thinks it is Thursday: its `release_date`
is tomorrow for the first two hours of its life. Refusing anything dated after
today would hold the week's releases back until two in the morning, on the one
day that matters. Keeping them and asking Deezer what plays takes them as they
land.

#### What has already been heard

A release you have already played is never poured in, and one you have played
since is taken back out. This cron does the whole of what its name promises: it
already reads the playlist and the history to decide what to add, and those are
the same two answers the removal needs, so it costs nothing.

The history holds a count rather than a duration: ninety three entries, which at
my measured rate is twenty five hours, but on a day with music in the background
is closer to six. Anything that falls out of it unseen stays in the playlist for
good, so the gap between two runs has to fit inside that. It is the reason this
cron runs hourly rather than daily, and it had a cron of its own until the
hourly schedule made that one redundant.

Whether that ninety three is a ceiling on the count or a window on the time is
still open, and it changes the answer — a window would hold twenty five hours
whatever you played. Every run logs `Listening history {tracks: n}`, so a few
days of them settle it.

Deezer answers the history fifty at a time and ignores `limit`, saying how many
there are under `total`. The pages are walked until they are all read: stopping
at the first would leave everything older than the fiftieth play behind, which
on that measurement is half a day.

Reading the history needs the `listening_history` permission, which the other
crons do not use. A run that cannot read it leaves the mark where it was, so
those releases stay reachable for the next one rather than being declared
covered while a played one could still be poured in.

### Remove duplicates

I have a lot of titles in my favorite playlist and I realized that there could be the same track several times, this is often due to a track present in an album and in an EP, an album that has been reissued, etc. New cron.  
This will delete last duplicate added track.

#### Arguments of the action

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

The workflows run on their own once the token secrets are set. `Run workflow` on the Actions tab runs a cron by hand, outside of its schedule.

`pnpm cron:once` is the command they run. It reads the cron from `CRON_NAME`, `CRON_ACTION` and `CRON_ARGUMENTS`, and the tokens from the environment beside them. Handy to check a token from a terminal without waiting for a schedule.

The other scripts are `pnpm test`, `pnpm lint` and `pnpm typecheck`, which the `Tests` workflow runs on every push and pull request. Nothing is type checked at run time: the crons are executed by `tsx`, so a type error fails the build rather than a nightly run.

Each run also writes a summary on its page in the Actions tab, above the log:

```
## family-playlist

- 3 tracks added to playlist 9499677562
- 1 track removed from playlist 9499677562
```

### When each one runs

Their schedules live in their own workflow, in UTC, in the second half of the
hour. Reading them off `.github/workflows`:

| Cron | Schedule | |
|---|---|---|
| family-playlist | `23 * * * *` | hourly |
| car-playlist | `33 * * * *` | hourly |
| lucas | `43 * * * *` | hourly |
| thibaut | `53 * * * *` | hourly |
| new-releases | `48 * * * *` | hourly |
| remove-duplicates | `26 23 * * *` | daily, middle of the night |

### Good to know

- GitHub evaluates the workflow schedules in UTC and does not know about daylight saving, so the daily run drifts by an hour between summer and winter. It fires in the early morning, where it does not matter.
- GitHub's scheduler is best effort and promises no upper bound. It says a scheduled run can be delayed under load, that the start of every hour is its high load window, and that a queued job may be dropped outright rather than merely run late. Every cron here sits in the second half of the hour for that reason, and every script is idempotent, so a late, repeated or skipped run is harmless. Measured here on the day the crons were written: nothing fired at all for nine hours, then every one of them resumed, one to forty minutes behind its slot. Absence for an afternoon is not a fault to chase.
- Measured again the next day, over the thirteen hours that followed: an hourly cron was served four times out of thirteen slots. The scheduler wakes in bursts — four of them, thirty to eighty minutes long, two and a half to six hours apart — and runs what is due in each. So a schedule here is a request rather than a promise, and a cron that has to happen once a day asks every hour.
- A scheduled workflow is automatically disabled after 60 days without activity in the repository.
- Actions logs are public on a public repository, and a Deezer request carries the `access_token` in its query string. Three layers answer for it: GitHub masks the secrets it hands to the job, the run registers them again with `::add-mask::`, and the logger censors them itself — by key, and by value wherever a token appears in a string, so a url leaks nothing either.
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
