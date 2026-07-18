'use client';

import { useEffect } from 'react';

/**
 * App Router global error boundary. Reports uncaught render errors to Sentry
 * when a DSN is configured. Sentry is imported *dynamically* and only when a
 * DSN exists, so a no-DSN build never pulls the heavy server SDK / OpenTelemetry
 * into this client component (which otherwise destabilises dev compilation).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => undefined);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: '0.5rem', color: '#71717a' }}>
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
            background: '#18181b',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
