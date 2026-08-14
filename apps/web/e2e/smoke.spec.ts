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
    checks: {
      database?: { ok: boolean };
      notification_queue?: { ok: boolean };
      migrations?: { ok: boolean };
    };
  };
  expect(body.status).toMatch(/ok|degraded/);
  expect(body.checks.database?.ok).toBe(true);
  // Notification queue check should pass unless backlog > 500 — alarms loudly
  // if the worker has stalled.
  expect(body.checks.notification_queue?.ok).toBe(true);
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

test('legacy employer slug no longer reveals the employer — redirects to /join', async ({ page }) => {
  // Confidentiality (P-F): which companies have a Richmond MOU must not be
  // discoverable. The old /apply/<slug> landing exposed the employer by name;
  // it now redirects to the generic access-code entry and names no employer.
  await page.goto('/apply/sino-metals-leach-zambia-limited');
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('heading', { name: /Join your employer/i })).toBeVisible();
  await expect(page.getByText(/Sino Metals/i)).toHaveCount(0);
});

test('the employer picker and homepage list no employers', async ({ page }) => {
  // Both former enumeration surfaces are closed: /apply redirects to the code
  // gate, and the homepage offers a code CTA instead of a partner list.
  await page.goto('/apply');
  await expect(page).toHaveURL(/\/join$/);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Enter your access code/i })).toBeVisible();
});

test('an unknown access code is rejected without revealing anything', async ({ page }) => {
  await page.goto('/join?code=ZZZZZZZZ');
  await expect(page.getByText(/didn.t match/i)).toBeVisible();
  // The generic entry form is still shown; no employer is named.
  await expect(page.getByLabel(/Access code/i)).toBeVisible();
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
