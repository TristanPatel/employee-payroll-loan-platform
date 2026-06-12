# Production operations runbook

Practical playbook for keeping `portal.richmond-afri.com` live and
recovering from problems. Optimised for "what do I do right now" rather
than encyclopedic coverage.

## At a glance

| Layer | Provider | Where to look |
|---|---|---|
| Web app | Fly.io (`richmond-eplp-portal`) | https://fly.io/dashboard |
| Database / Auth / Storage / Edge Functions | Supabase (`slmrpvlhttgrhoinpfwa`) | https://supabase.com/dashboard |
| DNS | Cloudflare (`richmond-afri.com` zone) | https://dash.cloudflare.com |
| SMS | Twilio (account "Richmond") | https://console.twilio.com |
| Email | Resend (`loans.richmond-afri.com`) | https://resend.com/emails |
| Error capture | Sentry | https://sentry.io |

## First response — "the portal is down"

1. **Check `/api/health`** — `https://portal.richmond-afri.com/api/health`.
   - `200 ok`: app + DB are healthy. Likely a routing / DNS / TLS issue,
     not the app itself.
   - `503 degraded`: app is up but a dependency check failed. The JSON
     body lists which check is failing (database / notification_queue /
     migrations).
2. **Fly status** — Fly dashboard → app → Monitoring. Look for crashed
   machines or failed health checks.
3. **Supabase status** — dashboard → project → top-right indicator.
4. **Twitter `@flydotio` and `@supabase`** for upstream incidents.

If `/api/health` is unreachable but Fly says "running", the problem is
between Fly and the user — Cloudflare DNS, TLS, or a regional outage.

## Common incidents

### Edge Function fails repeatedly (notification-worker)

**Symptom**: `notifications.status='failed'` rows piling up, or
`notification_queue` check in `/api/health` going red.

**Diagnose**:
```sql
select error, count(*)
  from public.notifications
 where status='failed'
 group by error order by 2 desc limit 10;
```

Then look at recent worker invocations:
- Supabase dashboard → Edge Functions → `notification-worker` → Logs.

**Common causes & fixes**:
| Error | Fix |
|---|---|
| `Twilio not configured` | Re-set `TWILIO_*` secrets (Edge Function secrets). |
| `Resend not configured` | Re-set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`. |
| `Authentication Error - invalid username` | Twilio token rotated / pasted with whitespace. |
| `The X domain is not verified` (Resend) | DNS for `loans.richmond-afri.com` regressed — re-verify. |
| `21408 Permission to send an SMS has not been enabled` | Twilio geo permission for the destination country needs enabling. |

**Re-queue failed rows after the fix**:
```sql
update public.notifications
   set status='queued', error=null
 where status='failed' and created_at > now() - interval '6 hours';
```

The pg_cron drain picks them up within 5 minutes; to drain immediately:
```sql
select net.http_post(
  url := 'https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker',
  headers := jsonb_build_object('Content-Type','application/json'),
  body := '{}'::jsonb
);
```

### Borrower can't sign in (email rate limit)

**Symptom**: borrowers report "email rate limit exceeded" on OTP signup.

Supabase Auth uses a custom SMTP route through Resend; the throttle is
much higher than the built-in mailer. If it still trips:
- Supabase dashboard → Authentication → Rate Limits → raise the limits.
- Verify SMTP in dashboard → Settings → Authentication → SMTP — host
  `smtp.resend.com`, port 465, username `resend`.

### Contract stuck `fully_signed` but won't seal

`/api/seal` refuses if `document_storage_path` is null on the contract.
**Fix**: master_admin opens `/admin/contracts`, clicks
**"Regenerate Part A"** on that row, then **"Seal"**.

Root cause: `generate-part-a` Edge Function transiently failed during
apply submission (the call is best-effort and swallows errors so it
doesn't block the borrower).

### Disbursement is stuck on a loan

`record_disbursement` enforces maker-checker: the recorder and the
authoriser must be different `auth.uid()`s. If you're operating
single-handed you can't disburse from your own master_admin session —
sign in as a second staff account (use `/admin/staff` to onboard one).

### Cron drain stopped firing

Check the schedule:
```sql
select jobname, schedule, active
  from cron.job
 where jobname='notification_worker_drain';
```

If `active=false` or it's missing, re-apply the cron schedule block from
`supabase/migrations/20260515140000_23_repayment_reconciliation.sql`
(the `do $$ ... end $$;` block near the bottom).

## Database backups & restore

Supabase Pro tier (which this project uses) does **automatic daily
backups for 7 days** + **point-in-time recovery (PITR) for the last 2
hours**. No manual setup required.

### Restore from a backup

Use cases: you ran a bad migration, a master_admin accidentally
mass-deleted rows, etc.

1. Supabase dashboard → Database → **Backups**.
2. Pick the timestamp to restore to.
3. **Branching first**: clone the current DB into a Supabase preview
   branch (one click), apply the restore to the branch, verify the data
   you need is there. Promote the branch to main only after verifying.
4. Restore to production. The web app will reconnect automatically.

**Critical**: any rows written between the snapshot and the restore
point are lost. If the restore is a panic move, first run:
```sql
copy (select * from public.<table>) to '/tmp/snapshot.csv';
```
on the tables you care about, so you can diff and replay.

### Manual logical backup (one-off)

```bash
PGPASSWORD=<db-password> pg_dump \
  "postgresql://postgres@db.slmrpvlhttgrhoinpfwa.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-acl \
  > backup-$(date +%Y%m%d).sql
```

Useful before risky migrations. Snapshots include data, schema, and
RLS policies but not Auth users (those live in `auth.users` and are
backed up separately by Supabase).

## Migration hygiene

- New migrations live in `supabase/migrations/`.
- File name: `YYYYMMDDHHMMSS_NN_short_description.sql`.
- Every PR opens a Supabase preview branch which auto-applies the
  migrations against a copy of production. Branch must turn green
  before merge — that proves the migration replays cleanly.
- Never edit a merged migration. Add a new one to fix it.

## Secret rotation

| Secret | Where | How |
|---|---|---|
| `TWILIO_AUTH_TOKEN` | Twilio Console → API keys | Rotate, paste new value into Supabase Edge Function secrets. Worker picks it up on next invocation. |
| `RESEND_API_KEY` | Resend → API Keys | Same. Used by Edge Function secret + Supabase Auth SMTP. |
| `PADES_SIGNING_P12_*` | Generated by `pnpm tsx scripts/generate-signing-cert.ts` | 21-month rotation — see `docs/legal/signing-cert-rotation.md`. |
| `FLY_API_TOKEN` | Fly Console → Tokens | Used only by GitHub Actions `fly-deploy.yml`. |
| Supabase service-role key | Supabase → Settings → API | Set in pg_cron via `alter database postgres set app.settings.service_role_key`. |

## Incident response checklist

1. **Communicate first** — borrowers in active wizard sessions need to
   know. Tweet, WhatsApp the BoZ contact, email known borrowers, status
   page (when one exists).
2. **Stop the bleeding** — e.g. if a buggy migration is corrupting data,
   disable the Fly app (`flyctl scale count 0 -a richmond-eplp-portal`)
   while you fix it. Better to be down than to corrupt more.
3. **Diagnose** — `/api/health`, Fly logs, Supabase logs.
4. **Fix forward, not revert** — Supabase migrations don't roll back
   cleanly. Add a fix-up migration.
5. **Post-mortem within 48h** — write a short doc: what, when, who saw
   it, root cause, what you changed to prevent it, what you'd do
   differently next time. Even a one-pager.

## Test data hygiene

The smoke test contract from go-live setup (`2a74be1f…`) is a real
sealed PAdES contract used to validate the integration. Don't delete it
— it's the easiest way to demonstrate the verify flow to BoZ inspectors.

## Contacts

| Provider | Account holder | Billing |
|---|---|---|
| Fly.io | tristanpatel@yahoo.co.uk | Credit card on file |
| Supabase | tristanpatel@yahoo.co.uk | Pro tier |
| Twilio | "Richmond" account | Pay-as-you-go |
| Resend | tristanpatel@yahoo.co.uk | Free tier (3,000/mo) |
| Cloudflare | (Richmond IT) | Free |
