// import cron tasks
const { CronJob } = require('cron');
const { lastFavTracks } = require('./cron-scripts/last-tracks');
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
				lastFavTracks(cron.arguments);
				break;
			case 'sync-playlists':
				syncPlaylists(cron.arguments);
				break;
			case 'remove-duplicates':	
				removeDuplicates(cron.arguments);
				break;
			default:
				console.error('Wrong or missing action');
				break;
			}
		},
		null,
		true,
		'Europe/Paris',
		this,
		true,
	);
	dzrCronJob.start();
}
