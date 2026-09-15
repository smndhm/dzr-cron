import pino from 'pino';

// The Deezer access_token travels as an axios query parameter, so a failed
// request carries it in `err.config.params` and would end up in the public
// GitHub Actions logs.
const REDACTED_PATHS = [
  'access_token',
  'params.access_token',
  'config.params.access_token',
  'err.config.params.access_token',
  '*.access_token',
  '*.params.access_token',
  '*.config.params.access_token',
];

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
    redact: {
      paths: REDACTED_PATHS,
      censor: '[redacted]',
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
