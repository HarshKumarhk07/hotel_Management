import * as Sentry from '@sentry/node';
import { env, isTest } from './env';
import { logger } from './logger';

let enabled = false;

/**
 * Initialise Sentry error monitoring. A no-op unless `SENTRY_DSN` is set, so
 * local/dev/test and any deploy without a DSN run unchanged. Call once, as early
 * as possible in the bootstrap, before the app handles traffic.
 */
export function initSentry(): void {
  if (isTest || !env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  enabled = true;
  logger.info('🛰️  Sentry error monitoring enabled');
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Report an unexpected error to Sentry (no-op when disabled). */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
