const logger = require('pino')({
	mixin() {
		return { script: 'dzr-cron' };
	},
	timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
});
// import cron tasks
const { CronJob } = require('cron');
const { lastTracks } = require('./cron-scripts/last-tracks');
const { syncPlaylists } = require('./cron-scripts/sync-playlists');
const { removeDuplicates } = require('./cron-scripts/remove-duplicates');

// Cron Job

// Crons parameters
const { crons } = require('./config/crons.conf');

// Start all cron tasks
for (const cron of crons) {
	const dzrCronJob = new CronJob(
		cron.refreshInterval,
		() => {
			switch (cron.action) {
			case 'last-tracks':
				lastTracks(cron.arguments);
				break;
			case 'sync-playlists':
				syncPlaylists(cron.arguments);
				break;
			case 'remove-duplicates':
				removeDuplicates(cron.arguments);
				break;
			default:
				logger.error('Wrong or missing action');
				break;
			}
		},
		null,
		true,
		'Europe/Paris',
		this,
		true
	);
	dzrCronJob.start();
}
