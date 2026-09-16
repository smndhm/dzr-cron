// Crons parameters
import loadCron, { Cron } from './cron-conf';

// Walks the configuration and collects every access_token it holds
export const collectTokens = (cron: Cron): string[] => {
  const tokens = new Set<string>();

  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== 'object' || value === null) {
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (key === 'access_token' && typeof entry === 'string' && entry.length > 0) {
        tokens.add(entry);
        return;
      }
      collect(entry);
    });
  };

  collect(cron);
  return Array.from(tokens);
};

// GitHub already masks each secret it hands to the job, so this is a second
// layer, covering a token that reaches the run by any other route.
export default function maskTokens (env: NodeJS.ProcessEnv = process.env): string[] {
  return collectTokens(loadCron(env)).map((token) => `::add-mask::${token}`);
}

// Entry point, `pnpm cron:mask`
if (require.main === module) {
  maskTokens().forEach((command) => console.log(command));
}
