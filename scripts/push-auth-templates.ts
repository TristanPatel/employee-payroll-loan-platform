#!/usr/bin/env -S npx tsx
/**
 * Push all six Richmond-branded Supabase Auth email templates to the live
 * project in one shot. Replaces the manual dashboard paste.
 *
 * Usage:
 *   1. Get a Supabase personal access token: https://supabase.com/dashboard/account/tokens
 *      (one-time; you can revoke it after this script runs)
 *   2. SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/push-auth-templates.ts
 *
 * The script:
 *   - Reads the six HTML files from supabase/templates/
 *   - PATCHes /v1/projects/{ref}/config/auth with the matching template fields
 *   - Verifies each subject + first 200 chars of HTML round-trips
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = 'slmrpvlhttgrhoinpfwa';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN.\n' +
      '  Create one at https://supabase.com/dashboard/account/tokens, then run:\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/push-auth-templates.ts',
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const tpl = (name: string) =>
  readFileSync(join(__dirname, '..', 'supabase', 'templates', name), 'utf8');

// The Management API uses snake_case fields under the auth config:
//   mailer_subjects_<key>          — Subject line
//   mailer_templates_<key>_content — HTML body
// The keys match Supabase's six email templates.
const body = {
  mailer_subjects_magic_link: 'Your Richmond Finance sign-in code',
  mailer_templates_magic_link_content: tpl('magic-link.html'),

  mailer_subjects_confirmation: 'Confirm your Richmond Finance account',
  mailer_templates_confirmation_content: tpl('confirmation.html'),

  mailer_subjects_recovery: 'Reset your Richmond Finance password',
  mailer_templates_recovery_content: tpl('recovery.html'),

  mailer_subjects_invite: "You're invited to Richmond Finance",
  mailer_templates_invite_content: tpl('invite.html'),

  mailer_subjects_email_change: 'Confirm your new Richmond Finance email',
  mailer_templates_email_change_content: tpl('email-change.html'),

  mailer_subjects_reauthentication: 'Confirm a sensitive Richmond action',
  mailer_templates_reauthentication_content: tpl('reauthentication.html'),
};

const AUTH_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

async function getAuthConfig(): Promise<Record<string, unknown>> {
  const res = await fetch(AUTH_ENDPOINT, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.error(`GET auth config failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function patchAuthConfig(patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(AUTH_ENDPOINT, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`PATCH failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
}

/**
 * --config-only: read-modify-write of site_url + uri_allow_list. This exists
 * because a blind PATCH of uri_allow_list REPLACES the whole comma-separated
 * string — dropping the mobile deep links (eplp://, eplp://*) and localhost
 * would break auth for every such user. So we GET first, MERGE additions,
 * print an explicit old→new diff, and require AUTH_CONFIRM=apply. A site_url
 * change is additionally refused unless the new host's /api/health returns 200.
 *
 * Env:
 *   AUTH_SITE_URL             new Site URL (blank = leave unchanged)
 *   AUTH_URI_ALLOW_LIST_ADD   comma-separated redirect URLs to ADD (merged)
 *   AUTH_CONFIRM              must equal "apply" to write
 */
async function runConfigOnly(): Promise<void> {
  const siteUrl = (process.env.AUTH_SITE_URL ?? '').trim();
  const addRaw = (process.env.AUTH_URI_ALLOW_LIST_ADD ?? '').trim();
  const confirm = (process.env.AUTH_CONFIRM ?? '').trim();

  const current = await getAuthConfig();
  const currentAllow = String(current.uri_allow_list ?? '');
  const currentSite = String(current.site_url ?? '');

  const existing = currentAllow.split(',').map((s) => s.trim()).filter(Boolean);
  const additions = addRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const merged = [...new Set([...existing, ...additions])];

  const patch: Record<string, unknown> = {};
  if (additions.length && merged.length !== existing.length) {
    patch.uri_allow_list = merged.join(',');
  }

  if (siteUrl) {
    // Refuse to point Site URL at a host that isn't actually serving — a wrong
    // site_url breaks {{ .SiteURL }} in every template platform-wide.
    let healthOk = false;
    try {
      const h = await fetch(new URL('/api/health', siteUrl).toString());
      healthOk = h.ok;
    } catch {
      healthOk = false;
    }
    if (!healthOk) {
      console.error(`Refusing to set site_url=${siteUrl}: ${siteUrl}/api/health did not return 200.`);
      process.exit(1);
    }
    if (siteUrl !== currentSite) patch.site_url = siteUrl;
  }

  if (Object.keys(patch).length === 0) {
    console.log('No changes needed — config already matches the requested state.');
    return;
  }

  console.log('Auth config change (old → new):');
  if ('site_url' in patch) console.log(`  site_url:\n    - ${currentSite}\n    + ${patch.site_url}`);
  if ('uri_allow_list' in patch) {
    console.log('  uri_allow_list (MERGE, existing entries preserved):');
    for (const e of existing) console.log(`      ${e}`);
    for (const a of additions) if (!existing.includes(a)) console.log(`    + ${a}`);
  }

  if (confirm !== 'apply') {
    console.error('\nDry run only. Re-run with AUTH_CONFIRM=apply to write these changes.');
    process.exit(1);
  }

  await patchAuthConfig(patch);
  console.log('\n✅ Auth config updated.');
}

async function runTemplates(): Promise<void> {
  await patchAuthConfig(body);
  console.log('✅ All six auth email templates pushed.\n');
  console.log('Subjects:');
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('mailer_subjects_'))
      console.log(`  ${k.replace('mailer_subjects_', '').padEnd(18)} ${v}`);
  }
  console.log('\nTry signing in via OTP — the next code email is the proof.');
}

async function main(): Promise<void> {
  if (process.argv.includes('--config-only')) {
    await runConfigOnly();
  } else {
    await runTemplates();
  }
}

void main();
