# Trigger

GitHub's scheduler has never run a single cron in this repository. Every
`schedule` slot since the workflows were created has been missed — hourly crons,
and two five minute probes that do nothing but print the date. Manual runs work
every time, so the workflows themselves are fine. This is a known and open
problem, reported by others since January 2026 in
[community discussion 147369](https://github.com/orgs/community/discussions/147369),
with no reply from GitHub.

`workflow_dispatch` works. So something outside GitHub asks for the runs, and
GitHub's own schedules stay in place underneath, harmless, in case the
scheduler ever comes back.

This is a Cloudflare Worker: free, nothing to administer, and its schedule lives
in git next to the workflows it triggers rather than in a web form.

## Setting it up

1. **A token.** On GitHub, `Settings` > `Developer settings` >
   `Personal access tokens` > `Fine-grained tokens`. Scope it to
   `smndhm/dzr-cron` alone, and give it one permission: `Actions: Read and
   write`. Nothing else — this token may only ask for a run.

2. **Deploy.** From this directory:

   ```sh
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN   # paste the token
   npx wrangler deploy
   ```

3. **Check it.** `npx wrangler tail` streams the worker's logs. The next slot
   should show a dispatch, and the run appears in the Actions tab a few seconds
   later, marked `workflow_dispatch` rather than `schedule`.

## Keeping it honest

The schedules in `wrangler.toml` mirror `.github/workflows/cron-*.yml` one for
one, in UTC on both sides, so the cron strings are identical. Changing one means
changing the other, and `worker.js` throws rather than fail quietly if a cron
fires with no workflow behind it.

A fine-grained token expires. GitHub emails before it does; a dispatch answering
`401` in the worker's logs is the same news, later.

## When GitHub fixes its scheduler

`probe-direct.yml` is still on `master` for that. It is five lines, it prints
the date every five minutes, and it has never once run. The day it does, the
scheduler is back, and this whole directory can go.
