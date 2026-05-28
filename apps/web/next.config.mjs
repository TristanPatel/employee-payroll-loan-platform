/** @type {import('next').NextConfig} */
// Deploy trigger: 2026-05-28 — force fresh production build of Phase 0-10.
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@eplp/shared', '@eplp/ui'],
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry only when a DSN is configured. Keeps local dev
// fast (no source-map upload) and CI green when the Sentry org token
// hasn't been set yet.
let exported = nextConfig;
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = await import('@sentry/nextjs');
  exported = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
}

export default exported;
