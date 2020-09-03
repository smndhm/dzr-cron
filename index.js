// import cron tasks
const { lastFavTracks } = require("./cron-scripts/last-fav-tracks");
const { syncPlaylists } = require("./cron-scripts/sync-playlists");

// Cron Job
const { CronJob } = require("cron");

// Crons parameters
const { crons } = !["development", "test"].includes(process.env.NODE_ENV)
  ? require("./config/crons.conf")
  : require("./config/crons.conf-test");

// Start all cron tasks
for (const cron of crons) {
  const dzrCronJob = new CronJob(
    cron.refreshInterval,
    () => {
      switch (cron.action) {
        case "last-fav-tracks":
          lastFavTracks(cron.arguments);
          break;
        case "sync-playlists":
          syncPlaylists(cron.arguments);
          break;
        default:
          console.error("Wrong or missing action");
          break;
      }
    },
    null,
    false
  );
  dzrCronJob.start();
}
