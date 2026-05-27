// Client-side Sentry init. Loaded by Next.js when SENTRY_DSN is set.
// Sampling is conservative — Richmond Finance traffic is low so we
// can afford 100% transactions; tune down once volumes grow.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? 'development',
  });
}
