# Architecture overview

This document maps the source brief's sections onto concrete files and
deliverables, and is the entry point for engineers picking up the project
mid-phase.

## High-level diagram

```
┌──────────────────┐         ┌──────────────────┐
│ apps/web         │         │ apps/mobile      │
│ Next.js 14       │         │ Expo SDK 51      │
│ (Vercel)         │         │ (EAS internal)   │
└────────┬─────────┘         └────────┬─────────┘
         │  workspace imports         │
         ▼                            ▼
   ┌──────────────────────────────────────────┐
   │ packages/shared   (@eplp/shared)         │
   │   ├─ payroll/   PAYE, fees, interest,    │
   │   │            affordability, schedule   │
   │   ├─ schemas/   Zod for forms & RPCs     │
   │   ├─ money.ts   ngwee/ZMW helpers        │
   │   ├─ time.ts    Africa/Lusaka helpers    │
   │   ├─ ids.ts     loan number formatting   │
   │   └─ roles.ts   role enum + groupings    │
   │                                          │
   │ packages/ui       (@eplp/ui)             │
   │   └─ tokens.ts  Richmond design tokens   │
   └──────────────────┬───────────────────────┘
                      │ HTTPS only
                      ▼
   ┌──────────────────────────────────────────┐
   │ Supabase (eu-west-2)                     │
   │   ├─ Postgres 15 + RLS                   │
   │   ├─ Auth (Phone + Email + MFA)          │
   │   ├─ Storage (signed URLs, 15 min)       │
   │   └─ Edge Functions (Deno/TS):           │
   │       • application Part A PDF           │
   │       • pre-approval PDF                 │
   │       • offer + loan-agreement PDF       │
   │       • signing OTP                      │
   │       • PAdES-B-T cryptographic seal     │
   │       • monthly deduction schedule cron  │
   │       • bank-statement reconciler        │
   └──────────────────┬───────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │ Twilio              │
            │  • Verify (OTP)     │
            │  • Messaging (SMS)  │
            └─────────────────────┘
```

## Phase-to-section mapping

| Brief section | Lives in |
|---|---|
| §2 Tech stack | `package.json`, `apps/*/package.json`, `packages/*/package.json` |
| §3 Users & roles | `packages/shared/src/roles.ts`, Phase 1 migration `001_profiles.sql` |
| §4 Data model | Phase 1 migrations in `supabase/migrations/` |
| §5 Business logic | `packages/shared/src/payroll/*` (Phase 2 implementation) |
| §6 Workflows | UI in `apps/web/app/**` and `apps/mobile/app/**`; cron in `supabase/functions/` |
| §7 Web structure | `apps/web/app/` route tree |
| §8 Mobile structure | `apps/mobile/app/` route tree |
| §9 PDF templates | `supabase/functions/pdf-*` Edge Functions |
| §9A Digital contracts | `supabase/functions/contract-*` + `packages/shared/src/contracts/` |
| §10 Notifications | `supabase/functions/notify-*` + `packages/shared/src/notifications/` |
| §11 Security & compliance | RLS in Phase 1 migrations; pgTAP tests in `supabase/tests/` |
| §12 Seed data | `supabase/seed.sql` (Phase 1) |
| §13 Execution plan | This document — phase status in `README.md` |

## Key non-negotiables (Section 0 of the brief)

- **Money** is integer ngwee; display `K 1,234.56`. Use `@eplp/shared/money`.
- **Time** is `timestamptz`; display in Africa/Lusaka. Use `@eplp/shared/time`.
- **Interest** is straight-line: `P × r × n`. No amortisation libraries.
- **Maker-checker** on every state-changing approval. RLS enforces no
  self-approval.
- **Soft-delete only**. RLS forbids `DELETE` everywhere.
- **Contract evidence** is INSERT-only (`contract_signatures`,
  `contract_audit_events`). Sealed contracts cannot be mutated.

## URLs baked into sealed PDFs

These URLs are persisted into every PAdES-B-T-sealed contract certificate
of completion. **Do not change them once contracts are live** — DNS routing
can be moved, but the literal strings in the cert must keep resolving.

| URL | Role |
|---|---|
| `https://portal.richmond-afri.com` | App home + sign-in |
| `https://portal.richmond-afri.com/verify/{contract_id}` | Public contract verifier (no PII) |
| `https://www.richmond-afri.com/legal/signing-cert` | Public X.509 signing-cert pubkey |
