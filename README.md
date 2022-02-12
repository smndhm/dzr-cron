# Deezer Cron

Scripts to update my playlists

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure crons in `config/crons.conf.js` file

This file exports an array of crons, each cron has the following structure:

```javascript
{
  refreshInterval,
  action,
  arguments,
}
```

- `refreshInterval` is the cron schedule expression, see: https://crontab.guru/.
- `action` is the script to launch, can be "last-tracks" or "sync-playlists".
- `arguments` is the list of arguments to pass to the script, depends on the cron.

## Scripts

### Last favorites tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

Because my kids wants to have their tracks during "apéro", I updated this cron.

#### Structure for the `config/cron.conf.js` file

```javascript
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

#### Structure for the `config/cron.conf.js` file

```javascript
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

## Launch

You can now simply launch the script using npm: `npm run start` or node: `node .\index.js`.

## TODO

- [ ] Check API quota limit with multiples crons
- [ ] Better logs
- [ ] Add cron script to check and remove track if already exist
- [x] Edit last-tracks cron to be able to set a specific playlist
- [x] Tests
- [x] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
