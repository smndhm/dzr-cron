// Key holding a Deezer token anywhere in a logged payload
const TOKEN_KEY = 'access_token';
const CENSOR = '[redacted]';

// Censoring by key alone is one shape away from missing a token: a client that
// keeps the request url would carry it outside any access_token key. Every
// rendered line is censored by value too, for every token the run was given.
const secrets = new Set<string>();

// A Deezer token is around fifty characters. Anything short is a mistyped
// secret, and censoring it by value would eat those few characters out of every
// line; the access_token key stays censored anyway.
const MIN_SECRET_LENGTH = 8;

export const registerSecrets = (tokens: string[]): void => {
  tokens.forEach((token) => {
    if (token && token.length >= MIN_SECRET_LENGTH) {
      secrets.add(token);
    }
  });
};

export const forgetSecrets = (): void => {
  secrets.clear();
};

const censorSecrets = (line: string): string => {
  let censored = line;
  secrets.forEach((secret) => {
    if (censored.includes(secret)) {
      censored = censored.split(secret).join(CENSOR);
    }
  });
  return censored;
};

// Censors the access_token key at any depth, and guards against the circular
// references an error can hold.
const redactTokens = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactTokens(entry, seen));
  }

  const redacted: Record<string, unknown> = {};
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

export type LogOutput = (line: string) => void;

const toStdout: LogOutput = (line) => {
  process.stdout.write(`${line}\n`);
};

// An error is worth its stack, which already opens with its class and message,
// and its cause, which is the half that says what actually went wrong.
const render = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload instanceof Error) {
    const stack = payload.stack ?? `${payload.name}: ${payload.message}`;
    const { cause } = payload;
    return cause === undefined ? stack : `${stack}\nCaused by: ${render(cause)}`;
  }
  return JSON.stringify(redactTokens(payload));
};

export default function setLogger (script: string, output: LogOutput = toStdout) {
  const log = (level: string, payload: unknown, extra?: unknown): void => {
    const parts = [render(payload)];
    if (extra !== undefined) {
      parts.push(render(extra));
    }
    // Censoring the rendered line, so nothing escapes through a shape we did
    // not anticipate
    output(censorSecrets(`${new Date().toISOString()} ${level} [${script}] ${parts.join(' ')}`));
  };

  return {
    info: (payload: unknown, extra?: unknown) => log('INFO', payload, extra),
    warn: (payload: unknown, extra?: unknown) => log('WARN', payload, extra),
    error: (payload: unknown, extra?: unknown) => {
      errorCount++;
      log('ERROR', payload, extra);
    },
  };
}
