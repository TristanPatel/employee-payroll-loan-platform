# DNS setup

The portal is hosted on its own subdomain `portal.richmond-afri.com`,
so the existing marketing site at `www.richmond-afri.com` stays
untouched. This document captures the exact DNS records that need to
be added to the `richmond-afri.com` zone, plus the optional Resend
records for sending email.

All records are **additive** — nothing existing needs to change.

## 1. Portal subdomain (required)

```
Type:   CNAME
Name:   portal
Value:  cname.vercel-dns.com
TTL:    3600 (default)
```

After adding this, point the Vercel project's "Domains" tab at
`portal.richmond-afri.com`; Vercel will issue a Let's Encrypt SSL
certificate automatically. Propagation usually finishes within
5 minutes.

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
# → expects cname.vercel-dns.com

# Resend DKIM
dig TXT resend._domainkey.richmond-afri.com +short

# SPF
dig TXT richmond-afri.com +short | grep spf1
```

Once `portal.richmond-afri.com` resolves to Vercel, hit
`/api/health` from a browser — it should return JSON with all
checks green.

## Summary — minimum to go live

1. Add **one CNAME** for `portal.richmond-afri.com`.
2. Publish **one static page** at `www.richmond-afri.com/legal/signing-cert`.
3. (For email) Add Resend's **DKIM TXT** + update **SPF TXT**.

That's it. The marketing site stays exactly as it is.
