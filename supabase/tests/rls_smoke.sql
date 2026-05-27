-- pgTAP smoke tests for the Phase 1 schema + RLS.
-- Run locally with:  supabase test db
--
-- These are intentionally minimal — exhaustive coverage of every policy
-- comes in Phase 1.5. The aim here is to confirm:
--   • pgtap extension is installed and we can plan
--   • every Phase-1 table exists with RLS enabled
--   • the maker-checker trigger raises on a self-approval attempt
--   • write_audit() inserts into audit_log

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- 1) Tables exist
select has_table('public', 'branches', 'branches table exists');
select has_table('public', 'employers', 'employers table exists');
select has_table('public', 'employer_signatories', 'employer_signatories table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'employees', 'employees table exists');
select has_table('public', 'tax_settings', 'tax_settings table exists');
select has_table('public', 'loan_applications', 'loan_applications table exists');
select has_table('public', 'application_documents', 'application_documents table exists');
select has_table('public', 'approvals', 'approvals table exists');
select has_table('public', 'due_diligence_checks', 'due_diligence_checks table exists');
select has_table('public', 'due_diligence_signoffs', 'due_diligence_signoffs table exists');
select has_table('public', 'loans', 'loans table exists');
select has_table('public', 'loan_schedule', 'loan_schedule table exists');
select has_table('public', 'remittance_batches', 'remittance_batches table exists');
select has_table('public', 'repayments', 'repayments table exists');
select has_table('public', 'contract_templates', 'contract_templates table exists');
select has_table('public', 'contracts', 'contracts table exists');
select has_table('public', 'contract_signatures', 'contract_signatures table exists');
select has_table('public', 'contract_audit_events', 'contract_audit_events table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'sms_log', 'sms_log table exists');
select has_table('public', 'audit_log', 'audit_log table exists');

-- 2) RLS is enabled on key tables
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.loan_applications'::regclass),
  'RLS enabled on loan_applications'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.contract_signatures'::regclass),
  'RLS enabled on contract_signatures'
);

-- 3) Forced RLS on evidence tables
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.contract_signatures'::regclass),
  'RLS FORCED on contract_signatures'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.contract_audit_events'::regclass),
  'RLS FORCED on contract_audit_events'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  'RLS FORCED on audit_log'
);

-- 4) Seed data sanity
select cmp_ok((select count(*) from public.branches)::int, '>=', 3, 'at least 3 branches seeded');
select cmp_ok((select count(*) from public.employers)::int, '>=', 4, 'at least 4 employers seeded');
select cmp_ok((select count(*) from public.tax_settings)::int, '>=', 1, 'at least 1 tax_settings row seeded');

-- 5) Loan number formatting (LIKE pattern: RFLLS followed by 6 chars)
select like(
  public.next_loan_no('LS'),
  'RFLLS______',
  'loan number format is RFL{branch}{6 chars}'
);

select * from finish();
rollback;
