#!/usr/bin/env tsx
/**
 * One-off script to seed the very first master_admin user.
 *
 * USAGE:
 *   SUPABASE_URL=...           \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_EMAIL=tristan@richmond-fin.com \
 *   ADMIN_PASSWORD='choose-a-strong-one' \
 *   ADMIN_FULL_NAME='Tristan Patel' \
 *   pnpm tsx scripts/bootstrap-master-admin.ts
 *
 * Re-running with the same email is idempotent (no-ops if profile already
 * exists with role=master_admin and is_active=true).
 *
 * After this runs you can sign in at /sign-in with the email + password,
 * and immediately enrol MFA from the account settings page (Phase 3.5).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME ?? 'Master Admin';

if (!url || !serviceKey || !email || !password) {
  console.error(
    'Missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.info(`Bootstrapping master_admin <${email}> ...`);

  // Step 1: find or create the auth.users row
  // listUsers needs pagination, but we filter by email manually.
  let userId: string | undefined;
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = listed.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());

  if (existing) {
    userId = existing.id;
    console.info(`  existing auth.users row: ${userId}`);
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'master_admin', full_name: fullName },
    });
    if (createErr) throw createErr;
    userId = created.user.id;
    console.info(`  created auth.users row: ${userId}`);
  }

  // Step 2: upsert the profiles row with the right role + active flag.
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        role: 'master_admin',
        full_name: fullName,
        email,
        is_active: true,
      },
      { onConflict: 'id' },
    );
  if (profileErr) throw profileErr;

  console.info('  profile upserted as master_admin + active');
  console.info(`Done. Sign in at /sign-in with email=${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
