# Deezer Cron

Scripts to update my playlists

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure crons in crons.conf.js file

This file exports an array of crons, each cron has the following structure:

```javascript
{
  refreshInterval,
  action,
  arguments,
}
```

- `refreshInterval` is the cron schedule expression, see: https://crontab.guru/.
- `action` is the script to launch, can be "last-fav-tracks" or "sync-playlists".
- `arguments` is the list of arguments to pass to the script, depends on the cron.

## Scripts

### Last favorites tracks

Because it's better to have an offline playlist for the car. Because my favorite tracks playlist has too many tracks to go offline. Because I only wanted my latest favorite tracks, I made this cron.

#### Structure for the `cron.conf.js` file

```javascript
{
  refreshInterval: "0 * * * *",
    action: "last-fav-tracks",
    arguments: {
      access_token: "frblublublublublublublublublublublublublublublublu",
      playlistId: 1234567890,
      nbTracks: 25,
      noExplicitLyrics: true,
    },
}
```

#### Arguments

- `access_token` is your Deezer user token allowing the script to perform actions on your library. Needs `offline_access`, `manage_library` and `delete_library` permissions.  
  See how to get an access_token on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).
- `playlistId` is the playlist ID you want to update. Must belong to the access_token account.
- `nbTracks` is your playlist length. Optional, default is 50.
- `noExplicitLyrics` if you don't want tracks with explicit lyrics. Optional, default is false.

### Synchonize playlists

What happened, Lucas had its playlist on my account, I was adding tracks for him and then, one day, he went to see mom... _"What! You don't have my playlist?"_  
So I set the playlist public, mom added the playlist to its favorites, Lucas listens to its tracks... _"What! Can't you add tracks?"_  
I didn't set the playlist collaborative, mom created a new playlist, added tracks, Lucas went back to dad... _"What! You don't have my last tracks?"_  
Ok, new cron.

#### Structure for the `cron.conf.js` file

```javascript
{
  refreshInterval: "0 * * * *",
    action: "last-fav-tracks",
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

- [ ] Tests
- [ ] Check API quota limit with multiples crons
- [ ] Better logs
- [x] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
