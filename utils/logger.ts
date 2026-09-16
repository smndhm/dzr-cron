import pino from 'pino';

// Key holding a Deezer token anywhere in the logged payload
const TOKEN_KEY = 'access_token';
const CENSOR = '[redacted]';

// The tokens show up at several depths: one per playlist in the cron
// configuration, and one per failed request, where axios keeps it in
// `err.config.params` because it travels as a query parameter. pino's `redact`
// only takes fixed paths, so the whole payload is walked instead: the logs are
// public on a public repository, and a missed path is a leaked token.
const redactTokens = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
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
        return method.apply(this, args);
      },
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
  }, destination as pino.DestinationStream);
}
