# Operator handover

Pre-baked SQL + checklists for the deployment steps that need to be
copy-pasted into the Supabase dashboard. Treat each file as a paste-
and-run script; nothing in here mutates state when committed to git.

Order of operations (also see `docs/deployment.md`):

1. **Twilio + Resend secrets** — Supabase dashboard → Edge Functions →
   Manage Secrets. No script; values come from your Twilio/Resend
   dashboards.

2. **Resend domain verification** — Resend dashboard shows the exact
   DNS records to add (DKIM + return-path). See also `docs/dns-setup.md`.

3. **Vercel project** — import the GitHub repo, root = `apps/web`, set
   the env vars listed in `docs/deployment.md` Phase A.

4. **`portal.richmond-afri.com` CNAME** — see `docs/dns-setup.md`.

5. **Activate pg_cron drain**:
   ```sql
   alter database postgres set app.settings.service_role_key = '…';
   alter database postgres set app.settings.functions_url =
     'https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker';
   ```
   Then re-run the cron-scheduling DO block from migration 23.

6. **Sign up + bootstrap master_admin** — sign up via the portal with
   your master-admin email, then paste `ops/01-bootstrap-master-admin.sql`
   into the Supabase SQL editor (after editing the email address at the
   top of the file).

7. **Generate the signing cert** locally:
   ```bash
   pnpm tsx scripts/generate-signing-cert.ts \
     --cn 'Richmond Finance Limited' \
     --pass '<your-strong-passphrase>' \
     --out ./out
   ```
   Paste the three env vars it prints into Vercel. Publish
   `out/signing-cert-public.pem` at `www.richmond-afri.com/legal/signing-cert`.
   Delete `out/` after.

8. **Smoke test** the live portal per `docs/deployment.md` Phase H.
