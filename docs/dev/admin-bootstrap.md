# Bootstrapping the first master_admin

The signup trigger (`handle_new_user`) creates non-employee profiles as
**inactive** by design — you need an existing master_admin to flip them on.
That creates a chicken-and-egg problem for the very first admin. Resolve it
once with this script.

## One-off setup

You'll need the Supabase **service role key** (Supabase dashboard →
Project settings → API → `service_role` secret). The service-role key
bypasses RLS, so keep it out of the repo and rotate it if it leaks.

```bash
export SUPABASE_URL='https://slmrpvlhttgrhoinpfwa.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='eyJ...the-service-role-jwt...'
export ADMIN_EMAIL='tristan@richmond-fin.com'
export ADMIN_PASSWORD='choose-a-strong-12+-char-password'
export ADMIN_FULL_NAME='Tristan Patel'

pnpm tsx scripts/bootstrap-master-admin.ts
```

The script:
1. Looks up the email in `auth.users`. If absent, creates it with
   `email_confirm: true` and `user_metadata: { role: 'master_admin', … }`.
2. Upserts the `profiles` row with `role='master_admin'` and `is_active=true`.

Idempotent — re-running with the same email leaves things unchanged.

## After it succeeds

1. Visit `/sign-in` with the email + password.
2. You land on `/admin` with full master_admin permissions.
3. Enroll a TOTP MFA factor (Phase 3.5 will add the UI; for now use the
   Supabase auth client's `mfa.enroll()` API directly).
4. Create the next batch of staff via the `/admin/staff` UI (Phase 3.5).

## Future master_admins

Once one admin exists, additional admins are created via the regular signup
flow + an admin sets `role='master_admin'` + `is_active=true` from the
`/admin/staff` UI. The bootstrap script never needs to run again.
