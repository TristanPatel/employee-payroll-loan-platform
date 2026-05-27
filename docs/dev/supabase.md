# Supabase — provisioning + local-dev notes

## Remote project

- **Name**: `employee-payroll-loan-portal`
- **Ref**: `slmrpvlhttgrhoinpfwa`
- **Region**: `eu-west-1` (Ireland) — user-provisioned, kept; brief-suggested `eu-west-2` skipped
- **Org**: `Richmond Finance` (`nyidendwhsxnwaeowvjv`)
- **URL**: `https://slmrpvlhttgrhoinpfwa.supabase.co`

## Phase 1 schema status (all migrations applied to remote)

| File | Concern |
|---|---|
| `20260512080000_01_extensions.sql` | pgcrypto, uuid-ossp, citext |
| `20260512080100_02_enums.sql` | All 17 enum types (role, status, contract, etc.) |
| `20260512080200_03_helpers.sql` | `touch_updated_at()` trigger fn |
| `20260512080300_04_branches.sql` | branches |
| `20260512080400_05_employers.sql` | employers + 4 sub-tables (signatories, payroll config, benefits, documents) |
| `20260512080500_06_profiles.sql` | profiles (FK → auth.users) + role helpers (`is_richmond_staff`, `has_role`, etc.) |
| `20260512080600_07_employees.sql` | employees |
| `20260512080700_08_tax_settings.sql` | versioned PAYE / NAPSA / NHIMA config |
| `20260512080800_09_applications.sql` | loan_applications, application_documents, approvals, due_diligence_checks + signoffs (+ maker-checker triggers) |
| `20260512080900_10_loans_repayments.sql` | loans, loan_schedule, remittance_batches, repayments |
| `20260512081000_11_contracts.sql` | contract_templates (immutable once published), contracts (forward-only status), contract_signatures + contract_audit_events (INSERT-only) |
| `20260512081100_12_notifications_audit.sql` | notifications, sms_log, audit_log (append-only) |
| `20260512081200_13_sequences_and_audit.sql` | RFL{branch}{6} loan-no, RFS{0}+5-digit pre-approval serial, audit triggers on every state-bearing table |
| `20260512081300_14_rls_policies.sql` | RLS ON + force-RLS on evidence tables |
| `20260512081400_15_security_hardening.sql` | `set search_path = public` on every function, revoke EXECUTE from anon, narrow `contract_audit_events` INSERT policy |

**25 tables, 86 RLS policies, 0 tables without RLS.**

## Seed (applied to remote)

- 3 branches: Lusaka HQ (LS), Kitwe (KT), Ndola (ND)
- 4 employers: Sino Metals, Seba Foods 260 Brands, GRZ, Choppies (35% debt-ratio override)
- 1 tax_settings row (2025/2026 bands from the xlsm)
- 5 storage buckets: `application-docs`, `employer-docs`, `contracts`, `signatures`, `pop`

Re-run via `supabase/seed.sql` (idempotent).

## Auth config (in `supabase/config.toml`)

- Phone OTP + Email + TOTP-MFA enabled
- Minimum password length: 12, requires upper+lower+digit+symbol
- Session: 24h timebox, 30min inactivity timeout
- Site URL: `https://portal.richmond-afri.com`
- Redirect allow-list: portal + localhost + `eplp://`
- Rate limits: 30/hr for email/SMS/sign-ins

The auth.users → public.profiles linkage happens on first sign-in via a
trigger (added in Phase 1.5 alongside signup UI).

## TypeScript types

Regenerate with the MCP tool (`generate_typescript_types`) and write to
`packages/shared/src/types/database.ts`. The barrel
`@eplp/shared/types` re-exports `Database`, `Tables<T>`, `TablesInsert<T>`,
`TablesUpdate<T>`, `Enums<T>` for ergonomic consumption.

## pgTAP

`supabase/tests/rls_smoke.sql` runs a minimal smoke test plan (31 assertions:
tables exist, RLS enabled + forced on evidence, seed counts, loan number
format). Exhaustive RLS coverage lands in Phase 1.5.

Run locally: `supabase test db`.

## Pending for Phase 1.5

- Auth signup UI (employee phone OTP, employer email invite, staff invite +
  MFA enrolment screen)
- `handle_new_user()` trigger that creates a `profiles` row on
  `auth.users` insert
- Exhaustive pgTAP coverage (positive + negative cases for every policy)
- Demo Auth users (seed via Supabase Auth admin API, not SQL)
