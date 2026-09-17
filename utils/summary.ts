import { appendFileSync } from 'fs';
// Import logger
import { Logger } from './logger';

// What a script did to a playlist. The logs say it line by line; this says it
// once, at the top of the run's page.
export type Change = {
  action: 'tracks-added' | 'tracks-removed' | 'tracks-unplayable' | 'tracks-ordered',
  playlist: number,
  tracks?: number[],
};

const changes: Change[] = [];

export const forgetChanges = (): void => {
  changes.length = 0;
};

// Logs the change and keeps it for the summary, so a script cannot report one
// without the other
export const reportChange = (logger: Logger, change: Change): void => {
  changes.push(change);
  logger.info(change);
};

const count = (tracks: number[] | undefined, what: string): string => {
  const total = tracks?.length ?? 0;
  return `${total} ${what}${total === 1 ? '' : 's'}`;
};

const describe = (change: Change): string => {
  switch (change.action) {
  case 'tracks-added':
    return `${count(change.tracks, 'track')} added to playlist ${change.playlist}`;
  case 'tracks-removed':
    return `${count(change.tracks, 'track')} removed from playlist ${change.playlist}`;
  case 'tracks-unplayable':
    return `${count(change.tracks, 'track')} removed from playlist ${change.playlist}, not playable`;
  case 'tracks-ordered':
    return `playlist ${change.playlist} reordered`;
  }
};

export const renderSummary = (cron: string, errors: number): string => {
  const lines = [`## ${cron}`, ''];

  if (changes.length === 0) {
    lines.push('Nothing to change.');
  } else {
    changes.forEach((change) => lines.push(`- ${describe(change)}`));
  }

  if (errors > 0) {
    lines.push('', `**${count(new Array(errors), 'error')}**, see the log below.`);
  }

  return `${lines.join('\n')}\n`;
};

// GITHUB_STEP_SUMMARY is only set on a runner, so a local run writes nothing
export const writeSummary = (cron: string, errors: number, env: NodeJS.ProcessEnv = process.env): void => {
  const file = env.GITHUB_STEP_SUMMARY;
  if (file) {
    appendFileSync(file, renderSummary(cron, errors));
  }
};
