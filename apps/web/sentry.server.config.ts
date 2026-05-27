// Server-side Sentry init. Captures Server Component errors, route-
// handler exceptions, and edge runtime crashes when SENTRY_DSN is set.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    environment: process.env.VERCEL_ENV ?? 'development',
  });
}
