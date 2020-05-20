# Deezer Cron

Scripts to update my playlists

## Scripts

### Last favorites tracks

This is for my offline car playlist. It keeps it updated with my last favorites tracks.

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure crons in crons.conf.js file

This file exports an array of crons, each cron has the following structure:

```javascript
{
  refreshInterval: "0 * * * *",
    action: "last-fav-tracks",
    arguments: {
      access_token: "frblublublublublublublublublublublublublublublublu",
      playlistId: 1234567890,
      nbTracks: 10,
      noExplicitLyrics: true,
    },
}
```

- `refreshInterval` is the cron schedule expression, see: https://crontab.guru/.
- `action` is the script to launch, for now only "last-fav-tracks".
- `arguments` is the list of arguments to pass to the script:
  - `access_token` is your user token, see how to get yours on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth).  
    Needs `offline_access`, `manage_library` and `delete_library` permissions. (or you can [use this script](https://smndhm.github.io/dzr-cron/)).
  - `playlistId` is the playlist ID you want to update.
  - `nbTracks` is your playlist length. Optional, default is 50.
  - `noExplicitLyrics` if you don't want tracks with explicit lyrics. Optional, default is false.

### Launch

You can now simply launch the script using npm: `npm run start` or node: `node .\index.js`.

## TODO

- [ ] Second script: sync different accounts playlists
- [x] Cron script instead of using PM2 or others
- [x] Create page to generate an access_token
