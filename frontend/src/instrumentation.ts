// Next.js instrumentation hook. Loads the right Sentry init for the active
// runtime and forwards nested React Server Component request errors to Sentry.
// All of this is inert unless a Sentry DSN is configured.
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
