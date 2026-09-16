import pino from 'pino';

// Key holding a Deezer token anywhere in the logged payload
const TOKEN_KEY = 'access_token';
const CENSOR = '[redacted]';

// Censoring by key alone is one shape away from missing a token: a client that
// keeps the request url would carry it outside any access_token key. Censor by
// value too, for every token the run was given.
const secrets = new Set<string>();

export const registerSecrets = (tokens: string[]): void => {
  tokens.forEach((token) => {
    if (token) {
      secrets.add(token);
    }
  });
};

export const forgetSecrets = (): void => {
  secrets.clear();
};

const censorSecrets = (value: string): string => {
  let censored = value;
  secrets.forEach((secret) => {
    if (censored.includes(secret)) {
      censored = censored.split(secret).join(CENSOR);
    }
  });
  return censored;
};

// The tokens show up at several depths: one per playlist in the cron
// configuration, and one per failed request, where axios keeps it in
// `err.config.params` because it travels as a query parameter. pino's `redact`
// only takes fixed paths, so the whole payload is walked instead: the logs are
// public on a public repository, and a missed path is a leaked token.
const redactTokens = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (typeof value === 'string') {
    return censorSecrets(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  // Axios errors hold circular references
  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactTokens(entry, seen));
  }

  const redacted: Record<string, unknown> = {};
  // `message` and `stack` are not enumerable, so they are copied explicitly
  if (value instanceof Error) {
    redacted.type = value.constructor.name;
    redacted.message = value.message;
    redacted.stack = value.stack;
  }
  Object.entries(value).forEach(([key, entry]) => {
    redacted[key] = key === TOKEN_KEY ? CENSOR : redactTokens(entry, seen);
  });

  return redacted;
};

// The cron scripts log their failures instead of throwing, so this counter is
// what tells a single run whether something went wrong.
let errorCount = 0;

export const getErrorCount = (): number => errorCount;

export const resetErrorCount = (): void => {
  errorCount = 0;
};

export default function setLogger (script: string, destination?: pino.DestinationStream) {
  return pino({
    mixin() {
      return { script };
    },
    formatters: {
      log: (payload) => redactTokens(payload) as Record<string, unknown>,
    },
    hooks: {
      logMethod(args, method, level) {
        if (level >= 50) {
          errorCount++;
        }
        // pino types the arguments as a union of its overloads, which `apply`
        // cannot narrow on its own
        return method.apply(this, args as Parameters<pino.LogFn>);
      },
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
  }, destination as pino.DestinationStream);
}
