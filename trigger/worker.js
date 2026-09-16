// Plain JavaScript rather than TypeScript: this file is deployed to Cloudflare
// and never touched by the repository's tsc or vitest, and typing it would mean
// pulling Cloudflare's types in as a devDependency for code the test suite does
// not run.

// Which workflow each schedule is for. The keys must match wrangler.toml
// exactly, character for character: Cloudflare hands back the cron string that
// fired, and an entry it cannot find here is a cron that silently does nothing.
const WORKFLOWS = {
  '23 * * * *': 'cron-family-playlist.yml',
  '33 * * * *': 'cron-car-playlist.yml',
  '43 * * * *': 'cron-lucas.yml',
  '53 * * * *': 'cron-thibaut.yml',
  '26 23 * * *': 'cron-remove-duplicates.yml',
};

const REPO = 'smndhm/dzr-cron';
const REF = 'master';

const dispatch = async (workflow, token) => {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      // GitHub rejects an API request with no user agent.
      'user-agent': 'dzr-cron-trigger',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ ref: REF }),
  });

  // A dispatch answers 204 with an empty body. Anything else is a failure worth
  // reading: 401 is a bad or expired token, 403 a token without actions:write,
  // 404 a workflow file that was renamed here or there.
  if (response.status !== 204) {
    throw new Error(
      `${workflow}: GitHub answered ${response.status} ${response.statusText} ${await response.text()}`
    );
  }
};

export default {
  async scheduled (event, env, ctx) {
    const workflow = WORKFLOWS[event.cron];

    if (!workflow) {
      throw new Error(`No workflow for cron "${event.cron}", check wrangler.toml`);
    }

    // waitUntil keeps the worker alive until the request finishes. Without it a
    // scheduled invocation can be torn down with the dispatch still in flight.
    ctx.waitUntil(dispatch(workflow, env.GITHUB_TOKEN));
  },
};
