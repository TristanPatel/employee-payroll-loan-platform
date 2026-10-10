// Captures the REAL Richmond EPLP UI from a locally running production build of apps/web.
// Nothing is redrawn: every pixel below comes from Chromium rendering the app.
//
//   CAPTURE_BASE_URL  app origin (default http://localhost:3000)
//   PW_CHROMIUM       optional Chromium executable (default: Playwright's own browser)
//
// Writes screens/, sequences/ and boxes.json into ../public (what Remotion serves).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
// Reuse the Playwright already installed for the web app's e2e tests.
const require = createRequire(path.join(REPO, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000';
const OUT = path.resolve(HERE, '../public');
const EXE = process.env.PW_CHROMIUM || undefined;
for (const d of ['screens', 'sequences/calculator', 'sequences/join', 'sequences/signin']) mkdirSync(`${OUT}/${d}`, { recursive: true });

const boxes = {};
const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

async function ctx(kind) {
  const vp = kind === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 3 } : { width: 1440, height: 900, deviceScaleFactor: 2 };
  const c = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: kind === 'phone', hasTouch: kind === 'phone' });
  // Keep the capture independent of the live backend: answer only the OTP-send call with success so
  // the app's own code advances to its real code-entry screen. All other Supabase calls fail fast.
  // The landing page, /join and /sign-in render without the database.
  // Playwright matches routes in reverse registration order: catch-all first, OTP override last.
  await c.route('**/*.supabase.co/**', (r) => r.abort());
  await c.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return c;
}
const settle = (p) => p.waitForTimeout(250);
const rec = (name, b) => { if (b) boxes[name] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };

for (const kind of ['phone', 'desktop']) {
  const c = await ctx(kind);
  const p = await c.newPage();

  // ── Landing ──
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/screens/${kind}-home-fold.png` });
  if (kind === 'phone') {
    // Element boxes on the unscrolled phone fold: the "UI assembles" beat lands each crop here.
    const r = (b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    boxes.phoneFold = {
      header: r(await p.locator('header').boundingBox()),
      eyebrow: r(await p.getByText('Finance · Insurance · Advisory').boundingBox()),
      h1: r(await p.locator('h1').boundingBox()),
      lede: r(await p.getByText(/Apply on your phone in minutes/).boundingBox()),
      applyBtn: r(await p.getByRole('link', { name: /Apply now/ }).first().boundingBox()),
      waBtn: r(await p.getByRole('link', { name: /WhatsApp us/ }).first().boundingBox()),
      trust: r(await p.locator('ul', { hasText: 'Apply in minutes' }).first().boundingBox()),
      calculator: r(await p.locator('div.rounded-2xl', { has: p.getByText('Quick loan estimate') }).first().boundingBox()),
    };

  }
  await p.screenshot({ path: `${OUT}/screens/${kind}-home-full.png`, fullPage: true });
  await p.locator('header').screenshot({ path: `${OUT}/screens/${kind}-header.png` });
  await p.locator('h1').screenshot({ path: `${OUT}/screens/${kind}-hero-h1.png` });
  const calc = p.locator('div.rounded-2xl', { has: p.getByText('Quick loan estimate') }).first();
  await calc.screenshot({ path: `${OUT}/screens/${kind}-calculator.png` });
  await p.locator('ul', { hasText: 'Apply in minutes' }).first().screenshot({ path: `${OUT}/screens/${kind}-trust.png` });
  // (phone: the sticky header overlaps this button, so only the desktop crop is usable)
  if (kind === 'desktop') await p.getByRole('link', { name: /Apply now/ }).first().screenshot({ path: `${OUT}/screens/${kind}-apply-cta.png` });
  rec(`${kind}.calculator`, await calc.boundingBox());
  rec(`${kind}.slider.amount`, await p.locator('#amount').boundingBox());
  rec(`${kind}.slider.tenure`, await p.locator('#tenure').boundingBox());

  if (kind === 'phone') {
    // Real drag: amount slider K1,000 upward in K500 steps; the app recomputes every frame.
    // Stops at the app's own affordability edge (first "Too high" state is not saved).
    await calc.scrollIntoViewIfNeeded();
    rec('phone.calc.view', await calc.boundingBox());
    let i = 0;
    const okFrames = [];
    for (let v = 1000; v <= 10000; v += 500) {
      await p.locator('#amount').fill(String(v));
      await p.locator('#amount').evaluate((e) => e.blur());
      await settle(p);
      const ok = (await calc.getByText('Too high').count()) === 0;
      okFrames.push({ amount: v, affordable: ok });
      if (!ok) break;
      await calc.screenshot({ path: `${OUT}/sequences/calculator/${String(i++).padStart(3, '0')}.png` });
    }
    boxes.calculatorFrames = okFrames;
  }

  // ── /join ──
  await p.goto(`${BASE}/join`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/screens/${kind}-join.png` });
  const joinCard = p.locator('form[action="/join"]').locator('..');
  await joinCard.screenshot({ path: `${OUT}/screens/${kind}-join-card.png` });
  rec(`${kind}.join.card`, await joinCard.boundingBox());
  rec(`${kind}.join.input`, await p.locator('#code').boundingBox());
  rec(`${kind}.join.continue`, await p.getByRole('button', { name: 'Continue' }).boundingBox());
  if (kind === 'phone') {
    const code = '7K2P9QR4TX';
    await p.locator('#code').click();
    await joinCard.screenshot({ path: `${OUT}/sequences/join/000.png` });
    for (let k = 0; k < code.length; k++) {
      await p.keyboard.type(code[k]);
      await settle(p);
      await joinCard.screenshot({ path: `${OUT}/sequences/join/${String(k + 1).padStart(3, '0')}.png` });
    }
  }

  // ── /sign-in ──
  await p.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/screens/${kind}-signin.png` });
  const form = p.locator('form').first();
  await form.screenshot({ path: `${OUT}/screens/${kind}-signin-card.png` });
  if (kind === 'phone') {
    let n = 0;
    const shot = async () => form.screenshot({ path: `${OUT}/sequences/signin/${String(n++).padStart(3, '0')}.png` });
    await p.getByRole('button', { name: 'Email me a code instead' }).click();
    await settle(p);
    await shot();
    const email = p.locator('input[type="email"]');
    rec('phone.signin.email', await email.boundingBox());
    await email.click();
    for (const ch of 'mwila@employer.co.zm') { await p.keyboard.type(ch); }
    await settle(p);
    await shot();
    const btn = p.getByRole('button', { name: 'Email me a code', exact: true });
    rec('phone.signin.button', await btn.boundingBox());
    rec('phone.signin.form', await form.boundingBox());
    await btn.click();
    await p.locator('#otp').waitFor();
    await settle(p);
    await shot();
    const verify = p.locator('form').first();
    await p.locator('#otp').click();
    for (const ch of '482913') { await p.keyboard.type(ch); await p.waitForTimeout(60); }
    await settle(p);
    await verify.screenshot({ path: `${OUT}/sequences/signin/${String(n++).padStart(3, '0')}.png` });
  }
  await c.close();
}
await browser.close();
writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 2));
console.log(JSON.stringify(boxes, null, 1));
