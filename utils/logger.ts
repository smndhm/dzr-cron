import pino from 'pino';

export default function setLogger (script: string) {
  return pino({
    mixin() {
      return { script };
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
  });
}