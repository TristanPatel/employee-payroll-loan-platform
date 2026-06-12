import { expect, test } from '@playwright/test';

/**
 * Smoke tests: the bare minimum that proves a fresh deployment is alive.
 * Run against http://localhost:3000 locally or E2E_BASE_URL in CI
 * (typically the Vercel preview URL).
 */

test('health endpoint responds and reports database green', async ({ request }) => {
  const res = await request.get('/api/health');
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body.status).toMatch(/ok|degraded/);
  expect(body.checks?.database?.ok).toBe(true);
});

test('signing-cert page is publicly readable', async ({ page }) => {
  await page.goto('/legal/signing-cert');
  // Target the heading specifically — the page also contains "Document
  // signing certificate" in the header and the PEM body, so a bare text
  // locator trips Playwright's strict mode.
  await expect(page.getByRole('heading', { name: /Signing certificate/i })).toBeVisible();
});

test('sign-in form renders', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
});

test('verifier on a bogus contract id returns 404', async ({ page }) => {
  const res = await page.goto('/verify/00000000-0000-0000-0000-000000000000');
  expect(res?.status()).toBe(404);
});

test('protected admin route redirects unauthenticated users', async ({ page }) => {
  await page.goto('/admin');
  // Either lands on sign-in or shows the sign-in form
  await expect(page).toHaveURL(/sign-in/);
});
