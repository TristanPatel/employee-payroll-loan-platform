# Employee Payroll Loan Portal

Richmond Finance Limited's employer-scheme payroll-deduction loan platform.
Web + mobile + Supabase backend in a pnpm/Turborepo monorepo.

> Replaces a manual WhatsApp + Excel + paper workflow with an integrated
> origination, approval, disbursement, deduction-management, and
> digital-contracting system for Zambian employer-scheme loans.

## Status

| Phase | Description | Status |
|---|---|---|
| 0 | Repo + monorepo skeleton | done |
| 1 | Database + Auth (schema, RLS, seed, types) | **in progress** |
| 2 | Shared business logic (PAYE, fees, interest, schedule) | not started |
| 3 | Employer onboarding (web) | not started |
| 4 | Employee application + digital contract foundation | not started |
| 5 | Approval workflows (web + mobile) | not started |
| 6 | Disbursement + schedule | not started |
| 7 | Monthly deduction cycle | not started |
| 8 | Reports + audit + admin | not started |
| 9 | Mobile polish + EAS builds | not started |

## Layout

```
apps/
  web/        Next.js 14 (App Router) — admin, branch, employer, employee, public
  mobile/     Expo SDK 51 (Expo Router) — three-role native app
packages/
  shared/     @eplp/shared — Zod schemas, types, business-logic helpers
  ui/         @eplp/ui — design tokens
supabase/
  migrations/ SQL migrations (Phase 1+)
  functions/  Deno edge functions (Phase 4+)
  seed.sql    Local dev seed
docs/
  business-rules/   Formulas, due-diligence checklist, approval tiers
  legal/            Registered office, signing cert + rotation runbook
archive/      Soft-deleted assets (never edited again)
```

## Running locally

Requires Node 20 LTS and pnpm 9.

```bash
nvm use            # picks up .nvmrc
corepack enable    # picks up the pinned pnpm
pnpm install
pnpm dev           # turbo runs apps/web + apps/mobile in parallel
```

| Command | Effect |
|---|---|
| `pnpm dev` | Start both apps in dev mode |
| `pnpm --filter @eplp/web dev` | Only the Next.js app |
| `pnpm --filter @eplp/mobile start` | Only the Expo app |
| `pnpm lint` | Lint every workspace (`--max-warnings=0`) |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm test` | Vitest across workspaces |
| `pnpm format` | Prettier write |

Environment variables live in per-app `.env.local` files — see `.env.example`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system overview, links each
  section back to the source brief
- [`docs/business-rules/formulas.md`](docs/business-rules/formulas.md) —
  PAYE, NAPSA, NHIMA, fees, interest, settlement (canonical spec for Phase 2)
- [`docs/business-rules/due-diligence-checklist.md`](docs/business-rules/due-diligence-checklist.md) —
  the 22-item CSE + Branch Manager + Due Diligence Team checklist
- [`docs/business-rules/approval-thresholds.md`](docs/business-rules/approval-thresholds.md) —
  L1/L2/L3 tiers
- [`docs/legal/registered-office.md`](docs/legal/registered-office.md) —
  contact block used in every contract and PDF letterhead

## Repository scope

This is a **standalone** Supabase project. It is unrelated to the existing
Richmond LMS at `xljwzphzxdclukrdlypm`. Never write to that project from this
codebase.

## Soft-delete only

Nothing in this repository or its database is ever hard-deleted. To remove
something, set `deleted_at`, set `status = 'archived'`, or move files into
`archive/YYYY-MM-DD/`. See [Section 0 of the brief](#) for the operating
rules.
