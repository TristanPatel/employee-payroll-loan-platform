# DNS setup

The portal is hosted on its own subdomain `portal.richmond-afri.com`,
so the existing marketing site at `www.richmond-afri.com` stays
untouched. This document captures the exact DNS records that need to
be added to the `richmond-afri.com` zone, plus the optional Resend
records for sending email.

All records are **additive** — nothing existing needs to change.

## 1. Portal subdomain (required)

The portal runs on **Fly.io** (app `richmond-eplp-portal`), fronted by
Cloudflare DNS. Do the cert BEFORE the CNAME so TLS is issued the moment the
name resolves — no browser security-error window. **Order matters:**

**Step 1 — ask Fly for the cert (prints an `_acme-challenge` target):**
```bash
flyctl certs add portal.richmond-afri.com --app richmond-eplp-portal
# (or run the "Ops Dispatch → certs-add" GitHub Action)
```

**Step 2 — add the ACME challenge record it prints, grey-cloud (DNS only):**
```
Type:   CNAME
Name:   _acme-challenge.portal
Value:  <target printed by `flyctl certs add`>   # e.g. portal.richmond-afri.com.<hash>.flydns.net
Proxy:  DNS only (grey cloud)
TTL:    Auto
```

**Step 3 — poll until the certificate is issued:**
```bash
flyctl certs check portal.richmond-afri.com --app richmond-eplp-portal
# (or "Ops Dispatch → certs-check") — wait for "Certificate ... issued"
```

**Step 4 — only now point the subdomain at the Fly app, grey-cloud:**
```
Type:   CNAME
Name:   portal
Value:  richmond-eplp-portal.fly.dev
Proxy:  DNS only (grey cloud)     # orange-cloud proxy breaks Fly's ACME + double-terminates TLS
TTL:    Auto
```

> Cloudflare records for the Fly app **must be grey-cloud (DNS only)**. The
> orange proxy interferes with Fly's certificate validation and TLS. Confirm the
> `richmond-afri.com` zone has a CAA record permitting Let's Encrypt (or no CAA
> at all) before Step 1, or issuance fails.

An apex domain can't use a CNAME — for a bare domain use the A/AAAA addresses
from `flyctl ips list` instead. Not needed here (we use the `portal` subdomain).

## 2. Resend email (optional but recommended)

The portal sends notification emails from `noreply@richmond-afri.com`.
Without these records, emails will land in spam folders.

Resend will show you the exact values in their dashboard
(Domains → Add domain → richmond-afri.com). Typical records:

### DKIM (one record)

```
Type:   TXT
Name:   resend._domainkey
Value:  <key value from Resend dashboard — long base64 string>
TTL:    3600
```

### SPF (only one SPF record allowed per domain)

If `richmond-afri.com` already has an SPF record, **don't add a
second one** — append Resend to the existing one:

Existing (example):
```
v=spf1 include:_spf.google.com ~all
```

Updated:
```
v=spf1 include:_spf.google.com include:_spf.resend.com ~all
```

If no SPF record exists, add:

```
Type:   TXT
Name:   @ (apex)
Value:  v=spf1 include:_spf.resend.com ~all
TTL:    3600
```

### Optional DMARC (improves deliverability)

```
Type:   TXT
Name:   _dmarc
Value:  v=DMARC1; p=quarantine; rua=mailto:dmarc@richmond-afri.com
TTL:    3600
```

## 3. Signing-certificate page (no DNS, just publish a file)

The existing `www.richmond-afri.com` site needs **one static page**
at `/legal/signing-cert` that publishes the PEM-encoded public
certificate. This is a 5-minute job for whoever maintains the
marketing site — just drop the contents of
`out/signing-cert-public.pem` (generated via
`pnpm tsx scripts/generate-signing-cert.ts`) into a static page
or text file at that URL.

No DNS change is needed for this — the page lives on the existing
`www` subdomain.

## 4. Twilio (no DNS)

SMS is delivered from a Twilio-provided Zambia phone number; no
DNS records are involved. Just buy the number in the Twilio
dashboard and paste it into the Edge Function secrets.

## 5. Mobile-app deep links (future, optional)

When the iOS / Android apps are submitted to the App Store and
Google Play, you'll want `apple-app-site-association` and
`assetlinks.json` files on `www.richmond-afri.com` so that
`https://portal.richmond-afri.com/sign?token=...` magic-link URLs
open inside the installed app instead of the browser. That lands
with Phase 10's EAS build profile.

## Verification

After adding the records, verify with:

```bash
# Portal subdomain
dig CNAME portal.richmond-afri.com +short
# → expects richmond-eplp-portal.fly.dev

# Cert issued?
flyctl certs check portal.richmond-afri.com --app richmond-eplp-portal

# Resend DKIM
dig TXT resend._domainkey.richmond-afri.com +short

# SPF
dig TXT richmond-afri.com +short | grep spf1
```

Once `portal.richmond-afri.com` resolves to Fly **and the cert shows issued**,
hit `/api/health` from a browser over HTTPS — it should return JSON with
`checks.database.ok = true` (a 200). Only then flip the `fly.toml`
`[build.args] NEXT_PUBLIC_PORTAL_URL` to the new domain and set the
`CANONICAL_HOST` Fly secret to arm the redirect from the old `.fly.dev` host.

## Summary — minimum to go live

1. `flyctl certs add` → add the **`_acme-challenge` CNAME** → wait for issued →
   add the **`portal` CNAME** to `richmond-eplp-portal.fly.dev` (all grey-cloud).
2. Publish **one static page** at `www.richmond-afri.com/legal/signing-cert`.
3. (For email) Add Resend's **DKIM TXT** + update **SPF TXT**.

That's it. The marketing site stays exactly as it is.
