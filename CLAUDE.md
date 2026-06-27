# CLAUDE.md — Employee Payroll Loan Portal

Technical guide for AI assistants working in this repository. Document only
what exists; verify against source before changing. Default context is
Lusaka, Zambia and ZMW currency.

## Project Overview

Richmond Finance Limited's employer-scheme **payroll-deduction loan platform**.
It replaces a manual WhatsApp + Excel + paper workflow with an integrated
system for Zambian employer-scheme loans covering: employer onboarding,
employee loan origination, multi-tier approval (maker-checker), digital
contracting (PAdES-sealed PDFs), disbursement, monthly payroll-deduction
remittance, and reconciliation.

**Value proposition:** Originate, approve, sign, disburse, and reconcile
employer-scheme payroll loans end-to-end in one auditable system.

This is a **standalone** Supabase project (ref `slmrpvlhttgrhoinpfwa`). It is
unrelated to the existing Richmond LMS (`xljwzphzxdclukrdlypm`) — never write
to that project from this codebase.

## Monorepo Layout

pnpm workspace + Turborepo. Workspaces are `apps/*` and `packages/*`.

### Apps

| Path | Name | Purpose | Stack |
|---|---|---|---|
| `apps/web` | `@eplp/web` | Staff/admin, employer, employee, and public-apply web app. Routes: `app/admin/*` (employers, applications, loans, remittance, templates, contracts, inbox, observability), `app/portal/*` (employee: apply, sign, my-loan, profile, inbox), `app/apply/[slug]`, `app/verify/[contractId]` (public contract verifier), `app/api/*` (health, seal, evidence-export). | Next.js 14 (App Router, React 18), TypeScript strict, Tailwind 3, React Hook Form + Zod, TanStack Query, Supabase SSR, PDF signing (@signpdf, pdf-lib, node-forge), Sentry, Playwright e2e |
| `apps/mobile` | `@eplp/mobile` | Native app (three role groups). Expo Router tabs: index, my-loan, inbox, profile, plus sign-in. | Expo SDK 51 (Expo Router 3), React Native 0.74, Supabase JS, expo-secure-store, expo-local-authentication, expo-notifications, EAS builds |

### Packages

| Path | Name | Purpose |
|---|---|---|
| `packages/shared` | `@eplp/shared` | Shared business logic and types. Subpath exports: `./payroll` (PAYE, NAPSA, NHIMA, affordability, interest, fees, schedule, settlement, thresholds), `./schemas` (Zod for forms/RPCs: employer, apply), `./types` (incl. generated `database.ts`), `./supabase`. Plus `money.ts` (integer ngwee/ZMW), `time.ts` (Africa/Lusaka), `ids.ts` (loan numbers), `roles.ts` (role groups). Tests via Vitest (`payroll.test.ts`, `state-machine.test.ts`, `index.test.ts`). |
| `packages/ui` | `@eplp/ui` | Design tokens only (`tokens.ts`) — Richmond brand tokens. No component library. |

### Other top-level directories

- `supabase/` — `migrations/` (SQL, Postgres 15 + RLS), `functions/` (Deno edge functions), `seed.sql`, `config.toml`, `tests/rls_smoke.sql`.
- `docs/` — `ARCHITECTURE.md`, `deployment.md`, `dns-setup.md`, `business-rules/` (formulas, approval-thresholds, due-diligence-checklist, forms-and-contracts), `legal/` (registered-office, signing-cert-rotation), `dev/` (admin-bootstrap, supabase).
- `ops/` — `01-bootstrap-master-admin.sql` and README (one-time master-admin bootstrap).
- `scripts/` — `bootstrap-master-admin.ts`, `generate-signing-cert.ts`.
- `archive/YYYY-MM-DD/` — soft-deleted assets (e.g. `legacy-vehicle-tracker`). Never edited again.
- `.github/workflows/` — `ci.yml`, `fly-deploy.yml`, `e2e.yml`.

## Tech Stack (real versions)

- **Node** ≥ 20 (`.nvmrc`), **pnpm** 9.12.0 (pinned via `packageManager` / corepack)
- **Turborepo** 2.x, **TypeScript** 5.5 (strict, `tsconfig.base.json`: ES2022, Bundler resolution, `noUncheckedIndexedAccess`, declaration maps)
- **Web**: Next.js 14.2.35, React 18.3, Tailwind 3.4, Zod 3.23, React Hook Form 7.53, TanStack Query 5.51, `@supabase/ssr` 0.10 + `@supabase/supabase-js` 2.106, Sentry 8.45, PDF: `@signpdf/*` 3.2, `pdf-lib` 1.17, `node-forge` 1.3, `jszip`
- **Mobile**: Expo ~51.0, React Native 0.74.5, Expo Router ~3.5
- **Backend**: Supabase — Postgres 15, Auth (email + phone + MFA/TOTP), Storage, Deno Edge Functions
- **External**: Twilio (Verify OTP + Messaging SMS)
- **Tooling**: ESLint 8 (`--max-warnings=0`), Prettier 3 + tailwindcss plugin, Vitest 2, Playwright 1.49

## Build / Dev / Test Workflows

Setup:

```bash
nvm use            # Node 20 (.nvmrc)
corepack enable    # pnpm 9.12.0
pnpm install
```

Root scripts (turbo fans out across workspaces):

| Command | Effect |
|---|---|
| `pnpm dev` | Run web + mobile in dev (turbo, persistent, uncached) |
| `pnpm build` | `turbo run build` (depends on `^build`) |
| `pnpm lint` | Lint every workspace (`--max-warnings=0`) |
| `pnpm typecheck` | TS strict `--noEmit` across workspaces |
| `pnpm test` | Vitest across workspaces |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm clean` | Clean turbo outputs + node_modules |

Per-app:

| Command | Effect |
|---|---|
| `pnpm --filter @eplp/web dev` | Next.js dev on port 3000 |
| `pnpm --filter @eplp/web build` | Production Next build |
| `pnpm --filter @eplp/web e2e` | Playwright e2e (`apps/web/e2e`) |
| `pnpm --filter @eplp/mobile start` | Expo dev server |
| `pnpm --filter @eplp/shared test` | Payroll/state-machine unit tests |

Supabase (local stack via `supabase/config.toml`): API 54321, DB 54322,
Studio 54323, Inbucket 54324. Edge functions live in `supabase/functions/`
(`generate-part-a`, `notification-worker`).

CI (`.github/workflows/ci.yml`) on push to `main` / PRs: install (frozen
lockfile) → lint → typecheck → test → `pnpm --filter @eplp/web build`.

## Database Entities (real tables)

All in schema `public`, defined under `supabase/migrations/` (25 migrations,
Postgres 15, RLS enforced). Core tables:

- **Identity/org**: `profiles`, `branches`, `employers`, `employer_payroll_config`, `employer_benefits`, `employer_documents`, `employer_signatories`, `employees`, `tax_settings`
- **Origination**: `loan_applications`, `application_documents`, `due_diligence_checks`, `due_diligence_signoffs`, `approvals`
- **Lending**: `loans`, `loan_schedule`, `repayments`, `remittance_batches`, `loan_closures`
- **Contracts (INSERT-only evidence)**: `contract_templates`, `contracts`, `contract_signatures`, `contract_audit_events`
- **Ops**: `notifications`, `sms_log`, `audit_log`

Key enums (`02_enums.sql`): `user_role` (master_admin, branch_manager, cse,
approver_l1/l2, accounts, cfo, auditor, employer_admin, employer_signatory,
employee), `application_status`, `approval_tier` (l1/l2/l3),
`approval_decision`, `loan_status`, `loan_product` (payroll_loan,
salary_advance, top_up), `schedule_status`, `remittance_status`,
`contract_type`, `contract_status`, `contract_signatory_role`,
`contract_audit_event_type`, `document_type`, `notification_channel/status`.

Migrations also cover RLS policies (`14_rls_policies.sql`), security hardening,
storage policies, sequences/audit triggers, approval workflow, loan creation +
remittance, repayment reconciliation, refinancing/closure PDFs, and push
notifications.

## Deployment

- **Web → Fly.io** (primary). `fly.toml` app `richmond-eplp-portal`, region
  `jnb` (Johannesburg, closest to Zambia), builds the root `Dockerfile`,
  internal port 3000, healthcheck `/api/health`. Auto-deploys on push to
  `main` via `.github/workflows/fly-deploy.yml` (gated on `FLY_API_TOKEN`;
  creates the app if missing). See `docs/deployment.md` and `docs/dns-setup.md`.
- **Web → Railway** (alternative). `railway.json` uses the same `Dockerfile`,
  start `next start -H 0.0.0.0`, healthcheck `/api/health`.
- **Dockerfile**: `node:20-bookworm-slim`, corepack pnpm 9.12.0, installs the
  whole workspace and builds `@eplp/web`. (Currently `--no-frozen-lockfile`;
  restore frozen lockfile once git transport is reliable — see Dockerfile note.)
- **Mobile → EAS** (Expo builds; `apps/mobile/eas.json`).
- **Backend → Supabase** (hosted project `slmrpvlhttgrhoinpfwa`).
- Production app URL: `https://portal.richmond-afri.com`.

## Key Conventions (non-negotiables)

- **Money** is integer **ngwee**; display `K 1,234.56`. Use `@eplp/shared/money` — never floats.
- **Time** is `timestamptz`; display in **Africa/Lusaka**. Use `@eplp/shared/time`.
- **Interest** is straight-line `P × r × n`. No amortisation libraries.
- **Maker-checker** on every state-changing approval; RLS forbids self-approval.
- **Soft-delete only** — never hard-delete. Set `deleted_at` / `status = 'archived'`, or move files to `archive/YYYY-MM-DD/`. RLS forbids `DELETE`.
- **Contract evidence is INSERT-only** (`contract_signatures`, `contract_audit_events`); sealed contracts are immutable.
- **Sealed-PDF URLs are frozen** once contracts are live (`portal.richmond-afri.com`, `/verify/{id}`, `www.richmond-afri.com/legal/signing-cert`). DNS can move; the literal strings in certs must keep resolving.
- All business logic and Zod schemas live in `@eplp/shared` so web and mobile share one source of truth.
- Strict TypeScript; lint runs with `--max-warnings=0`.

## Environment Variables

Template: `.env.example`. Per-app `.env.local` (or root `.env`); never commit secrets.

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `SUPABASE_PROJECT_REF`
- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FROM_NUMBER`
- **PAdES signing**: `PADES_SIGNING_P12_PATH`, `PADES_SIGNING_P12_PASSWORD`, `PADES_TSA_URL` (default `https://freetsa.org/tsr`)
- **App URLs (baked into sealed PDFs — change carefully)**: `NEXT_PUBLIC_PORTAL_URL`, `NEXT_PUBLIC_VERIFY_URL_BASE`, `NEXT_PUBLIC_SIGNING_CERT_URL`

The anon key is public by design (RLS enforces access) and is baked into the
web client bundle at build time. The service-role key is server-only.

## Current State

Per `README.md` phase tracker:

- **Done**: Phase 0 (monorepo skeleton).
- **In progress**: Phase 1 (database + auth — schema, RLS, seed, types). Note: migrations through `25_push_notifications` exist and web routes for admin/portal/apply/verify/seal are present, so implementation is ahead of the README's stated phase status in places — verify against source.
- **Not started (per README)**: Phase 2 shared business logic, employer onboarding UI, employee application/contract UI, approval workflows, disbursement, monthly deduction cycle, reports/audit/admin, mobile polish + EAS builds.

When in doubt, check the route tree under `apps/web/app/`, the migrations under
`supabase/migrations/`, and the helpers under `packages/shared/src/` rather
than trusting the phase table.
