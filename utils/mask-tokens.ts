// Crons parameters
import loadCrons, { Crons } from './crons-conf';

// Walks the configuration and collects every access_token it holds
export const collectTokens = (crons: Crons): string[] => {
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

  collect(crons);
  return Array.from(tokens);
};

// GitHub only masks the secret as a whole, not the tokens nested in it, so each
// one is registered before anything else runs.
export default function maskTokens (env: NodeJS.ProcessEnv = process.env): string[] {
  return collectTokens(loadCrons(env)).map((token) => `::add-mask::${token}`);
}

// Entry point, `npm run cron:mask`
if (require.main === module) {
  maskTokens().forEach((command) => console.log(command));
}
