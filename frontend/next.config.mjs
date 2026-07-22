import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app is one workspace inside a larger repo with sibling lockfiles —
  // pin the file-tracing root so Next doesn't guess the wrong directory.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

// Only wrap with Sentry's build plugin when a DSN is configured, so the default
// (no-DSN) build is byte-for-byte unchanged. In production, set SENTRY_DSN /
// NEXT_PUBLIC_SENTRY_DSN (and SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN to
// upload source maps) to enable error monitoring.
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
