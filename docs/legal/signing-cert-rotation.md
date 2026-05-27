# Signing certificate rotation

The Richmond Finance contract-sealing certificate signs every PAdES-B-T
sealed PDF and is published at
`https://www.richmond-afri.com/legal/signing-cert` so external parties
can verify any contract.

Validity is **2 years** with rotation at the **21-month** mark.

## Generation (initial + rotation)

```bash
pnpm tsx scripts/generate-signing-cert.ts \
  --cn  'Richmond Finance Limited' \
  --pass 'choose-a-strong-passphrase' \
  --out  ./out
```

Outputs:

- `out/signing-cert-public.pem` — PEM public certificate.
- `out/signing-cert.p12` — PKCS#12 bundle with the private key + cert.

## Deploy

1. **Vercel** (production):
   - `PADES_SIGNING_P12_BASE64` ← `base64 -w0 out/signing-cert.p12`
   - `PADES_SIGNING_P12_PASSWORD` ← the `--pass` value
   - `NEXT_PUBLIC_SIGNING_CERT_PEM` ← contents of
     `out/signing-cert-public.pem`
2. **Supabase Vault** (back-up + access from Edge Functions):
   - `padesP12Base64` ← same base64
   - `padesP12Password` ← same passphrase
3. **Marketing site** (`www.richmond-afri.com`):
   - Upload `signing-cert-public.pem` to `/legal/signing-cert` as a
     text/plain endpoint.

## Manifest

Update this table on every generation:

| Version | Generated (UTC) | Common Name | Serial | Valid until | Notes |
|---|---|---|---|---|---|
| v1  | (placeholder) | Richmond Finance Limited | — | — | Cert not yet generated for this deployment |

## Tamper-evidence checklist (per rotation)

- [ ] New cert generated locally on an offline workstation.
- [ ] `.p12` never committed to git.
- [ ] `.p12` securely transferred to Vercel / Supabase Vault.
- [ ] Local `out/` directory wiped after deployment.
- [ ] Previous PEM kept on `/legal/signing-cert` archive for at least
      24 months so prior sealed PDFs remain verifiable.
- [ ] Internal counsel (Mweemba &amp; Partners) notified of rotation.

## Emergency revocation

If the private key is compromised:

1. Generate a new cert immediately following the steps above.
2. Update env vars on Vercel + Supabase Vault.
3. Publish a notice at `/legal/signing-cert` listing the compromised
   certificate's serial number and the date of revocation.
4. Initiate review of all contracts sealed since the last known-good
   date.

## Why self-signed

We control the key, the publication endpoint, and the verifier — the
chain of trust between the public and Richmond Finance does not require
a commercial CA. ICTA-licensed CA enrolment is on the roadmap for the
2027 rotation cycle pending legal review.
