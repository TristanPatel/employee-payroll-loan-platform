# Deployment runbook

This walks through everything needed to take Richmond Finance's Employee
Payroll Loan Portal from a fresh repository to a production environment
that can disburse loans.

Project context:

- **Supabase project**: `slmrpvlhttgrhoinpfwa` (https://slmrpvlhttgrhoinpfwa.supabase.co)
- **Web app**: `apps/web` → Vercel (Next.js 14, App Router)
- **Mobile app**: `apps/mobile` → Expo / React Native, eventually iOS + Android stores
- **Edge functions** (already deployed):
  - `generate-part-a` — Part A loan-application PDF
  - `render-remittance-pdf` — monthly employer remittance schedule
  - `render-loan-statement` — borrower's final statement
  - `notification-worker` — drains queued SMS + email rows

## Phase A — Vercel project for the web app

1. In the Vercel dashboard, "Add New… → Project", import the GitHub
   repository, and point it at **`apps/web`** as the root directory.
2. Build command: `cd ../.. && pnpm install && pnpm --filter @eplp/web build`
3. Output directory: leave as default (`.next`).
4. Environment Variables → add the values from `apps/web/.env.example`.
   The anon key in the example file is correct; you'll also need to
   paste the `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard.
5. Once the first deploy succeeds, point the production domain
   `portal.richmond-afri.com` at the Vercel deployment.

## Phase B — Generate the PAdES signing certificate

The signing cert seals every finalised contract PDF and is published
at `/legal/signing-cert` so anyone can verify the signature.

```bash
pnpm tsx scripts/generate-signing-cert.ts \
  --cn  'Richmond Finance Limited' \
  --pass 'pick-a-strong-passphrase' \
  --out  ./out
```

Outputs:

- `out/signing-cert-public.pem` — public cert, safe to publish
- `out/signing-cert.p12` — private bundle, **NEVER COMMIT**

Add to Vercel:

```
PADES_SIGNING_P12_BASE64=<base64 -w0 out/signing-cert.p12>
PADES_SIGNING_P12_PASSWORD=<the --pass value>
NEXT_PUBLIC_SIGNING_CERT_PEM=<contents of out/signing-cert-public.pem>
```

Publish `signing-cert-public.pem` somewhere on `www.richmond-afri.com`.
Delete the local `out/` directory after deployment.

Without these env vars the seal route falls back to **soft-seal** mode
(stamped signatures + Certificate of Completion appended, but no Adobe
cryptographic banner). Soft-seal is fine for dev / staging.

Rotation: see `docs/legal/signing-cert-rotation.md` (21-month cycle).

## Phase C — Twilio + Resend for SMS and email

1. Create a Twilio account, buy a Zambia-friendly phone number, and
   note the Account SID + Auth Token.
2. Create a Resend account, add and verify the `richmond-afri.com`
   domain, and create an API key.
3. In the Supabase dashboard → Project Settings → Edge Functions →
   "Manage Secrets", add:

```
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_FROM_NUMBER=+260xxxxxxxxx
RESEND_API_KEY=re_xxxxxx
RESEND_FROM_EMAIL=noreply@richmond-afri.com
```

Without these the `notification-worker` Edge Function leaves SMS/email
rows queued indefinitely (no errors, just no delivery). In-app
notifications still work because they're inserted with `status='delivered'`
directly from the `notify()` SQL helper.

## Phase D — Activate the pg_cron drain

The cron job is already scheduled (every 5 minutes); it just needs the
auth header populated. In the Supabase SQL editor, run as a superuser:

```sql
alter database postgres set app.settings.service_role_key =
  '<service_role key from Supabase dashboard>';
alter database postgres set app.settings.functions_url =
  'https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker';
```

Then re-run the cron-scheduling DO block from
`supabase/migrations/20260515140000_23_repayment_reconciliation.sql`
(the final `do $$ ... end$$;` block) so the new settings are
interpolated into the cron command.

Verify with:

```sql
select jobname, schedule, command, active from cron.job
 where jobname = 'notification_worker_drain';
```

## Phase E — Bootstrap the first master_admin

1. Sign up via the live portal (`https://portal.richmond-afri.com/sign-in`)
   with the email you'll use as the master admin (e.g.
   `tristanpatel@yahoo.co.uk`).
2. Confirm the email — Supabase auto-creates a `profiles` row.
3. In the SQL editor, elevate to master_admin:

   ```sql
   update public.profiles set role='master_admin', is_active=true
    where id = (select id from auth.users where email='tristanpatel@yahoo.co.uk');
   ```

4. From now on, invite branch managers / CSEs / approvers / accounts /
   CFO via `/admin/staff`.

## Phase F — Seed branches + employers

Branches (Lusaka HQ, Kitwe, Ndola) are already seeded by migration 1.
Employers are seeded for demo purposes; add real production employers
via `/admin/employers/new`.

## Phase G — Mobile app build + distribution

The Expo project lives in `apps/mobile`. `app.json` already has the
Supabase URL + anon key wired in. For store builds:

```bash
cd apps/mobile
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

You'll need an Apple Developer account + Google Play Console for
distribution. For internal testing, share the EAS Internal Distribution
links.

## Phase H — Smoke test the full path

1. Sign up as an employee at the portal.
2. Apply at `/apply/sino-metals-leach-zambia-limited`.
3. Sign the loan agreement at `/portal/sign/{contract_id}`.
4. As `master_admin`, walk through `/admin/applications/{id}`:
   CSE → L1 → L2 → L3.
5. As `accounts`, record disbursement at `/admin/loans/{id}`.
6. As `accounts`, generate a remittance batch at `/admin/remittance`,
   download the PDF, mark sent, mark received, capture repayments.
7. On `/portal/my-loan` verify the schedule reflects everything.
8. Once outstanding hits zero, close the loan and download the
   statement PDF.

## Recurring ops

- **Cert rotation**: 21 months. See `docs/legal/signing-cert-rotation.md`.
- **Backups**: Supabase point-in-time-recovery is on by default on the
  Pro plan.
- **Monitoring**: hit `/api/health` (TODO — Phase 9) and `cron.job_run_details`
  for cron-drain success.
- **Twilio bill**: SMS pricing for Zambia is ~$0.07 per message; budget
  ~K1.50 per borrower per month assuming 2 SMS each (deduction reminder
  + receipt confirmation).

## Quick reference — env vars

### Vercel (production)

| Var | Source | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard, server-only | ✅ |
| `NEXT_PUBLIC_PORTAL_URL` | `https://portal.richmond-afri.com` | ✅ |
| `NEXT_PUBLIC_SIGNING_CERT_URL` | `https://www.richmond-afri.com/legal/signing-cert` | ✅ |
| `PADES_SIGNING_P12_BASE64` | Phase B | for hard-seal |
| `PADES_SIGNING_P12_PASSWORD` | Phase B | for hard-seal |
| `NEXT_PUBLIC_SIGNING_CERT_PEM` | Phase B | for hard-seal |
| `PADES_TSA_URL` | `https://freetsa.org/tsr` | optional |
| `PADES_SIGNER_COMMON_NAME` | `Richmond Finance Limited` | optional |

### Supabase Edge Function secrets

| Var | Source | Required |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio | for SMS |
| `TWILIO_AUTH_TOKEN` | Twilio | for SMS |
| `TWILIO_FROM_NUMBER` | Twilio | for SMS |
| `RESEND_API_KEY` | Resend | for email |
| `RESEND_FROM_EMAIL` | `noreply@richmond-afri.com` | for email |

### `alter database postgres set …`

| Setting | Value |
|---|---|
| `app.settings.service_role_key` | `<service_role key>` |
| `app.settings.functions_url` | `https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker` |
