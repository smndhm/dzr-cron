// A cron that never removes anything has no way of knowing what it has already
// seen: the playlist forgets a track the moment something takes it out. The
// playlist description is the one place Deezer lets us leave a note, so a run
// writes down the day it covered and the next one starts from there.
//
// It is a date rather than a list of ids on purpose: ten characters rather than
// ten per track, and it cannot outgrow the field.

const MARKER = /\s*\[dzr-cron:(\d{4}-\d{2}-\d{2})\]/;

const DAY = 24 * 60 * 60 * 1000;

// Deezer sometimes publishes a release after its own release_date, so a run
// looks slightly further back than the day it last covered.
const LAG_DAYS = 2;

export const asDate = (time: number): string =>
  new Date(time).toISOString().slice(0, 10);

// The day the previous run covered, moved back by the lag. Undefined when the
// description carries no mark, which is what a first run looks like.
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

// The description the run should leave behind: whatever the owner wrote, with
// exactly one mark at the end of it.
export const writeWatermark = (description: unknown, day: string): string => {
  const kept = typeof description === 'string' ? description.replace(MARKER, '') : '';
  return `${kept} [dzr-cron:${day}]`.trim();
};
