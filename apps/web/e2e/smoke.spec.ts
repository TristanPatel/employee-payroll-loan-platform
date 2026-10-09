import { expect, test } from '@playwright/test';

/**
 * Smoke tests — bare minimum that proves a fresh deployment is alive.
 * Run against http://localhost:3000 locally or E2E_BASE_URL in CI
 * (typically the Fly preview URL).
 *
 * These tests intentionally avoid login: keeping them unauthenticated
 * means no fixture management, no service-role keys in CI, and they can
 * run against the live production URL without side effects.
 */

test('health endpoint responds and reports database green', async ({ request }) => {
  const res = await request.get('/api/health');
  expect([200, 503]).toContain(res.status());
  const body = (await res.json()) as {
    status: string;
    checks: { database?: { ok: boolean } };
    signals: {
      notification_queue?: { ok: boolean; detail?: string };
      migrations?: { ok: boolean };
    };
  };
  // 'ok' or 'degraded' both mean the machine stays in rotation; only a failed
  // CRITICAL check (the DB) yields 'unhealthy' + 503.
  expect(body.status).toMatch(/ok|degraded/);
  expect(body.checks.database?.ok).toBe(true);
  // The notification queue is now an informational signal (depth + oldest age),
  // reported but never fatal — so it must not gate the 200. Just assert it's
  // present so a stalled worker is still observable here.
  expect(body.signals.notification_queue).toBeDefined();
});

test('signing-cert page renders (and exposes a real PEM in production)', async ({ page }) => {
  await page.goto('/legal/signing-cert');
  await expect(page.getByRole('heading', { name: /Signing certificate/i })).toBeVisible();
  // CI runs against a local build without NEXT_PUBLIC_SIGNING_CERT_PEM and
  // legitimately falls back to the placeholder. Only assert a real cert when
  // the test run is flagged as targeting the production deployment.
  if (process.env.E2E_EXPECT_PRODUCTION_SECRETS === '1') {
    const body = await page.content();
    expect(body).toContain('-----BEGIN CERTIFICATE-----');
    expect(body).not.toContain('-----BEGIN PLACEHOLDER-----');
  }
});

test('sign-in form renders and can toggle to OTP mode', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
  // Both modes should be reachable from the public sign-in page so staff can
  // self-provision via OTP without a password (master_admin onboarding flow).
  await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  await page.getByRole('button', { name: /Email me a code/i }).click();
  await expect(page.getByRole('button', { name: /Email me a code/i }).first()).toBeVisible();
});

test('apply landing renders for the demo employer slug', async ({ page }) => {
  await page.goto('/apply/sino-metals-leach-zambia-limited');
  await expect(page.getByRole('heading', { name: /Sino Metals/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start application/i })).toBeVisible();
});

test('apply landing 404s for an unknown employer slug', async ({ page }) => {
  const res = await page.goto('/apply/this-employer-does-not-exist-zzz');
  expect(res?.status()).toBe(404);
});

test('verifier on a bogus contract id returns 404', async ({ page }) => {
  const res = await page.goto('/verify/00000000-0000-0000-0000-000000000000');
  expect(res?.status()).toBe(404);
});

test('protected admin route redirects unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/sign-in/);
});

test('middleware bounce preserves the original path in ?next=', async ({ page }) => {
  // The whole post-sign-in routing chain hangs off this param: middleware
  // records where the user was headed, and /launch validates it against the
  // signed-in role's home after auth.
  await page.goto('/admin/applications');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fapplications/);
});

test('unauthenticated /launch redirects to sign-in', async ({ page }) => {
  await page.goto('/launch');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('unauthenticated /launch with a hostile next stays on our origin', async ({ page, baseURL }) => {
  // Even before auth, /launch must never emit a redirect the browser could
  // resolve off-origin (protocol-relative next).
  await page.goto('/launch?next=' + encodeURIComponent('//evil.example.com'));
  const url = new URL(page.url());
  expect(url.origin).toBe(new URL(baseURL ?? 'http://localhost:3000').origin);
  expect(url.pathname).toBe('/sign-in');
});

test('protected portal route redirects unauthenticated users to sign-in', async ({ page }) => {
  // /portal/apply requires an authenticated employee — anyone unauthenticated
  // must be bounced rather than seeing a server error.
  const res = await page.goto('/portal/apply');
  await expect(page).toHaveURL(/sign-in/);
  expect(res?.status()).toBeLessThan(500);
});
