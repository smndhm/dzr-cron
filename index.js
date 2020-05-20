// import cron tasks
const { lastFavTracks } = require("./cron-last-fav-tracks");

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
      if (cron.action === "last-fav-tracks") {
        lastFavTracks(cron.arguments);
      }
    },
    null,
    false
  );
  dzrCronJob.start();
}
