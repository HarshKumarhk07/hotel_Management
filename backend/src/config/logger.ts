import pino, { type LoggerOptions } from 'pino';
import { env, isProd, isTest } from './env';

/**
 * Pretty-print logs in development, but ONLY if `pino-pretty` is actually
 * installed. It is a devDependency, so production images built with
 * `npm ci --omit=dev` don't have it — attempting to use it there crashes the
 * process at startup. Falling back to plain JSON keeps the app booting even if
 * NODE_ENV is misconfigured.
 */
function resolvePrettyTransport(): LoggerOptions['transport'] {
  if (isProd || isTest) return undefined;
  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    };
  } catch {
    return undefined; // pino-pretty not available → structured JSON logs
  }
}

/**
 * Structured JSON logging in production (ingestible by Datadog / Loki / etc.),
 * pretty-printed in development. Silent during tests to keep output clean.
 */
export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  base: { service: 'kds-backend', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  transport: resolvePrettyTransport(),
});

export type Logger = typeof logger;
