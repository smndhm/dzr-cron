# Deezer Cron

Scripts to update my playlists

## Scripts

### Last favorites tracks

This is for my offline car playlist. It keeps it updated with my last favorites tracks.

## Install

### Clone the repo and install dependancies

`git clone git@github.com:smndhm/dzr-cron.git && cd dzr-cron && npm ci`

### Configure .env file

- Rename `.env.example` file to `.env`
- Set `.env` file variables:
  - DZR_ACCESS_TOKEN is your user token, see how to get yours on the [Deezer API OAuth doc](https://developers.deezer.com/api/oauth), needs `offline_access` `manage_library` and `delete_library` permissions.
  - LAST_FAV_PLAYLIST_ID is the playlist ID you want to update.
  - LAST_FAV_PLAYLIST_NB_TRACKS is your playlist length. Optional, default is 50.
  - LAST_FAV_PLAYLIST_NO_EXPLICIT if you don't want tracks with explicit lyrics. Optional, default is false.

### Launch

You can now simply launch the script using node: `node .\cron-last-fav-tracks.js` or make a cron task.

I have been using [PM2](https://pm2.keymetrics.io/). Here the command for the cron to run every hour: `pm2 start ./cron-last-fav-tracks.js --no-autorestart --cron "0 * * * *"`

## TODO

- [ ] Cron script instead of using PM2 or others
- [ ] Second script: sync different accounts playlists
- [x] Create page to generate an access_token
