# Deployment runbook

This walks Richmond Finance's Employee Payroll Loan Portal from a fresh
clone to a production deployment that can disburse loans.

Project context:

- **Hosting**: **Fly.io** — app `richmond-eplp-portal`, region `jnb`, Docker
  image built from the root `Dockerfile`. Deploys automatically on push to
  `main` via `.github/workflows/fly-deploy.yml`; config in `fly.toml`. (This
  project was briefly scoped for Railway; Phases A/B below are **superseded** —
  the authoritative deploy is Fly. See `fly.toml`, the fly-deploy workflow, and
  `docs/ops-runbook.md`.)
- **Domain**: `portal.richmond-afri.com` (subdomain — decided to stay on
  the existing Richmond Finance brand rather than spin up a separate domain;
  see [Domain strategy](#domain-strategy) below).
- **DNS**: Cloudflare (zone `richmond-afri.com`).
- **Database / backend**: Supabase project `slmrpvlhttgrhoinpfwa`
  (https://slmrpvlhttgrhoinpfwa.supabase.co).
- **Web app**: `apps/web` (Next.js 14 App Router; built and run inside the
  Docker image).
- **Mobile app**: `apps/mobile` (Expo / React Native — distributed via EAS).
- **Edge Functions** (already deployed):
  - `generate-part-a` — Part A loan-application PDF
  - `render-remittance-pdf` — monthly employer remittance schedule
  - `render-loan-statement` — borrower final statement
  - `notification-worker` — drains SMS / email / push queue (Twilio,
    Resend, Expo Push)

## Domain strategy

We host on **`portal.richmond-afri.com`** rather than a new dedicated
domain. The trade-off favoured the subdomain because:

- Borrowers reach the portal via their employer relationship with Richmond
  — recognition of the parent brand reduces phishing-suspicion friction at
  sign-up.
- Resend DKIM is already verified on `richmond-afri.com`; switching domains
  would force a 2-4 week email-deliverability warmup.
- Both BoZ and employer partners see a single legal entity.
- Cookies are scoped per-subdomain by default, so there's no cross-app
  security leakage.

Migrate to a dedicated domain later via a 301 redirect if/when the loan
product is positioned as a standalone fintech brand. Not now.

## Phase A — Railway service (SUPERSEDED — the portal runs on Fly.io)

> The steps in Phases A and B describe an earlier Railway setup and are kept for
> historical context only. The live deployment is Fly.io: `fly.toml` +
> `.github/workflows/fly-deploy.yml` build and run the same root `Dockerfile`.
> For env vars on Fly, use `flyctl secrets set` (runtime) and the
> `fly.toml [build.args]` for build-time `NEXT_PUBLIC_*` values.

1. Sign in to railway.app → **New Project → Deploy from GitHub repo**.
2. Authorise Railway against the GitHub org and pick
   `TristanPatel/employee-payroll-loan-platform`, branch **`main`**.
3. Railway auto-detects the root `Dockerfile` and starts building from the
   tip of `main`. No root-directory, build-command or output-directory
   settings to touch — the Dockerfile owns all of it.
4. Once the first deploy is `READY`, copy the auto-generated
   `*.up.railway.app` domain. Visit `/api/health` — should return JSON
   with `database.ok: true` once the service-role key is set (next step).

The project is configured in `railway.json`:

- Builder: `DOCKERFILE` (root `Dockerfile`)
- Healthcheck: `/api/health` with a 120 s timeout
- Restart policy: `ON_FAILURE`, up to 3 retries

## Phase B — Environment variables (Railway service)

Railway → service → **Variables** tab → add at minimum:

```
SUPABASE_SERVICE_ROLE_KEY    = <Supabase dashboard → Settings → API → service_role>
NEXT_PUBLIC_PORTAL_URL       = https://portal.richmond-afri.com
NEXT_PUBLIC_SIGNING_CERT_URL = https://www.richmond-afri.com/legal/signing-cert
```

The Supabase URL + anon key are already baked into the Docker image at
build time (anon key is intentionally public; RLS enforces access).

Once the PAdES signing certificate is generated (Phase D below), add:

```
PADES_SIGNING_P12_BASE64     = <base64 -w0 out/signing-cert.p12>
PADES_SIGNING_P12_PASSWORD   = <your chosen passphrase>
NEXT_PUBLIC_SIGNING_CERT_PEM = <contents of out/signing-cert-public.pem>
```

Optional but recommended for production:

```
SENTRY_DSN                = <Sentry project DSN>
NEXT_PUBLIC_SENTRY_DSN    = <same DSN>
SENTRY_AUTH_TOKEN         = <Sentry source-map upload token>
SENTRY_ORG / SENTRY_PROJECT
```

Without Sentry vars the web build auto-skips error capture (no failure).

## Phase C — Twilio + Resend (Supabase Edge Function secrets)

In Supabase dashboard → **Edge Functions → Manage Secrets** (project
`slmrpvlhttgrhoinpfwa`) add:

```
TWILIO_ACCOUNT_SID    = ACxxxxxx  (Twilio console home)
TWILIO_AUTH_TOKEN     = xxxxxx    (Twilio console, eye icon)
TWILIO_FROM_NUMBER    = +260...   (Twilio → Active Numbers)
RESEND_API_KEY        = re_xxxxxx (Resend → API Keys)
RESEND_FROM_EMAIL     = noreply@richmond-afri.com
```

Without these, in-app notifications still work; SMS/email rows just queue
indefinitely (no errors). The `notification-worker` Edge Function picks
secrets up on next invocation — no redeploy needed.

## Phase D — Generate the PAdES signing certificate

The cert seals every finalised contract PDF and is published at
`/legal/signing-cert` so any party can verify.

```bash
pnpm tsx scripts/generate-signing-cert.ts \
  --cn  'Richmond Finance Limited' \
  --pass 'pick-a-strong-passphrase' \
  --out  ./out
```

Outputs `out/signing-cert-public.pem` (public; safe to publish) and
`out/signing-cert.p12` (private; never commit). Paste the three env vars
in Phase B; publish `signing-cert-public.pem` at
`www.richmond-afri.com/legal/signing-cert`. Delete `out/` afterwards.

Rotation: 21 months. See `docs/legal/signing-cert-rotation.md`.

Without the PAdES vars the seal route falls back to "soft-seal" (stamped
signatures + Certificate of Completion appendix, no Adobe cryptographic
banner). Soft-seal is fine for dev/staging.

## Phase E — Activate the pg_cron notification drain

**Required, not optional:** the `notification-worker` Edge Function now rejects
any call whose `Authorization: Bearer` is not the service-role key (it holds the
service role and must not be publicly invocable). Until the steps below run, the
cron POSTs an empty bearer and every drain 401s — notifications silently pile up.
In the Supabase SQL editor as a superuser:

```sql
alter database postgres set app.settings.service_role_key =
  '<service_role key>';
alter database postgres set app.settings.functions_url =
  'https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker';
```

Then re-run the final `do $$ ... end $$;` block from
`supabase/migrations/20260515140000_23_repayment_reconciliation.sql` so
the cron command interpolates the new settings (it builds the
`Authorization: Bearer` header from `app.settings.service_role_key`). Verify the
next drain returns HTTP 200, and confirm the queue drains. Verify the job with:

```sql
select jobname, schedule, command, active
  from cron.job where jobname = 'notification_worker_drain';
```

## Phase F — Cloudflare DNS

Records to add on the `richmond-afri.com` zone (additive — nothing
existing changes). Exact target values for Resend appear in the Resend
dashboard when you add the domain.

```
# Portal
Type:   CNAME
Name:   portal
Value:  <Railway custom-domain CNAME target — visible in Settings → Networking>
Proxy:  DNS only (grey cloud) — Railway terminates TLS, don't proxy

# Resend DKIM (one TXT — exact value from Resend dashboard)
Type:   TXT
Name:   resend._domainkey
Value:  <long base64 key from Resend>

# Resend SPF — append to existing v=spf1 record OR create:
Type:   TXT
Name:   @
Value:  v=spf1 include:_spf.resend.com ~all

# Optional DMARC
Type:   TXT
Name:   _dmarc
Value:  v=DMARC1; p=quarantine; rua=mailto:dmarc@richmond-afri.com
```

In Railway → service → **Settings → Networking → Custom Domain** →
enter `portal.richmond-afri.com` → it shows you the exact CNAME target to
paste in Cloudflare.

## Phase G — Bootstrap the first master_admin

1. On the live portal `https://portal.richmond-afri.com/sign-in`, sign in
   with the email you want as master_admin. Confirm the OTP — Supabase
   auto-creates a `profiles` row.
2. In the SQL editor:

   ```sql
   update public.profiles set role='master_admin', is_active=true
    where id = (select id from auth.users where email='<your email>');
   ```

   The templated form lives in `ops/01-bootstrap-master-admin.sql`.
3. From `/admin/staff`, invite branch managers / CSEs / approvers / accounts / CFO.

## Phase H — Mobile (EAS, later)

The Expo project's already wired with the Supabase URL + anon key in
`apps/mobile/app.json`. For store builds:

```bash
cd apps/mobile
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

Profiles in `apps/mobile/eas.json`: `development`, `preview` (internal
TestFlight + Google Play internal track), `production`.

## Phase I — Smoke test end-to-end

1. Sign up as a borrower via `/apply/sino-metals-leach-zambia-limited`.
2. Step through the 6-step apply wizard, submit.
3. Sign the loan agreement at `/portal/sign/{contract_id}`.
4. As master_admin walk `/admin/applications/{id}` → CSE → L1 → L2 → L3.
5. As accounts record disbursement at `/admin/loans/{id}`.
6. Generate a remittance batch at `/admin/remittance`, capture repayments.
7. Verify `/verify/{contract_id}` shows the public certificate.

## Quick reference — env vars

### Railway service variables

| Var | Required for |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | DB writes from server actions |
| `NEXT_PUBLIC_PORTAL_URL` | Verify links in PDFs / emails |
| `NEXT_PUBLIC_SIGNING_CERT_URL` | Verify links in sealed contracts |
| `PADES_SIGNING_P12_BASE64` | Hard PAdES seal (else soft-seal) |
| `PADES_SIGNING_P12_PASSWORD` | Hard PAdES seal |
| `NEXT_PUBLIC_SIGNING_CERT_PEM` | Public verifier page |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | Error capture |

### Supabase Edge Function secrets

| Var | Required for |
|---|---|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS delivery |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email delivery |

### `alter database postgres set …`

| Setting | Value |
|---|---|
| `app.settings.service_role_key` | `<service_role key>` |
| `app.settings.functions_url` | `https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker` |
