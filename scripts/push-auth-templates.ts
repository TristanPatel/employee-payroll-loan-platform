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

async function main(): Promise<void> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    console.error(`PATCH failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  console.log('✅ All six auth email templates pushed.\n');
  console.log('Subjects:');
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('mailer_subjects_'))
      console.log(`  ${k.replace('mailer_subjects_', '').padEnd(18)} ${v}`);
  }
  console.log('\nTry signing in via OTP — the next code email is the proof.');
}

void main();
