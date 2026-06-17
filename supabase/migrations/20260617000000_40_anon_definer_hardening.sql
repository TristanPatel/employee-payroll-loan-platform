-- Phase 6 / 40 — Tighten anon EXECUTE on two SECURITY DEFINER functions.
--
-- Migration 31 (harden_definer_grants_and_public_verifier) revoked the default
-- PUBLIC/anon EXECUTE grant from every SECURITY DEFINER function it could see.
-- Two functions escaped it because they were created LATER, in migration 32
-- (employer_attestation_flow), and so kept Postgres' default "EXECUTE to
-- PUBLIC" grant. The security advisor flags both as
-- anon_security_definer_function_executable. This migration closes the gap.
--
-- Verified against the live database before writing:
--   • has_role(user_role[])                  — single overload; referenced by
--     21 RLS policies, all TO authenticated, 0 public-role. authenticated holds
--     a DIRECT grant, so revoking PUBLIC does not strip it.
--   • app_request_employer_attestation()     — RETURNS trigger, fired only by
--     trg_app_request_attestation on loan_applications. PostgREST never exposes
--     trigger functions as RPCs, and trigger firing does not consult EXECUTE
--     grants, so every client role can lose EXECUTE without affecting behaviour.
--
-- Deliberately NOT touched here (documented so a future reader doesn't "finish
-- the job" and break things):
--   • verify_contract(uuid)   — intentionally anon-executable; the public
--     /verify/[contractId] page calls it through the anon key (migration 31,
--     part 2). Revoking would break the public contract verifier.
--   • is_richmond_staff()     — still referenced by two public-role policies
--     (public.remittance_batches.remittance_batches_select_staff and
--     storage.objects.remittances_read_staff). Revoking anon EXECUTE risks a
--     "permission denied for function" error when anon evaluates those policies.
--     Retarget both policies to authenticated first if you want to revoke it.

-- has_role: re-assert the authenticated + service_role grants (idempotent, and
-- guarantees correctness on a database rebuilt purely from migrations) BEFORE
-- removing the PUBLIC grant, so authenticated never loses access mid-migration.
grant  execute on function public.has_role(public.user_role[]) to authenticated, service_role;
revoke execute on function public.has_role(public.user_role[]) from anon, public;

-- app_request_employer_attestation: a trigger function. Strip EXECUTE from every
-- client role; keep service_role for parity with migration 31's trigger-function
-- treatment. The trigger continues to fire regardless.
revoke execute on function public.app_request_employer_attestation() from public, anon, authenticated;
grant  execute on function public.app_request_employer_attestation() to service_role;
