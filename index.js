// import cron tasks
const { lastFavTracks } = require("./cron-last-fav-tracks");
const { syncPlaylists } = require("./cron-sync-playlists");

// Cron Job
const CronJob = require("cron").CronJob;

// Crons parameters
const { crons } =
  process.env.NODE_ENV !== "development"
    ? require("./crons.conf")
    : require("./crons.dev");

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
