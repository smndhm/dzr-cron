// This cron removes tracks, so the playlist cannot be its memory of what it has
// seen. The description is the one place Deezer lets it leave a note: each run
// writes the day it covered, and the next starts there. A date rather than a
// list of ids, so it cannot outgrow the field.

const MARKER = /\s*\[dzr-cron:(\d{4}-\d{2}-\d{2})\]/;

const DAY = 24 * 60 * 60 * 1000;

// Deezer sometimes publishes a release after its own release_date
const LAG_DAYS = 2;

export const asDate = (time: number): string =>
  new Date(time).toISOString().slice(0, 10);

// The day the previous run covered, less the lag. Undefined on a first run.
export const readWatermark = (description: unknown): string | undefined => {
  if (typeof description !== 'string') {
    return undefined;
  }
  const found = description.match(MARKER);
  if (!found) {
    return undefined;
  }
  return asDate(Date.parse(`${found[1]}T00:00:00Z`) - LAG_DAYS * DAY);
};

// Whatever the owner wrote, with exactly one mark at the end of it
export const writeWatermark = (description: string, day: string): string =>
  `${description.replace(MARKER, '')} [dzr-cron:${day}]`.trim();
