-- Phase 1 / 15 — Security hardening from advisor feedback.
--
-- Fixes:
--   • function_search_path_mutable: pin search_path on every function
--   • anon/authenticated_security_definer_function_executable: revoke
--     EXECUTE from anon on helpers; allow authenticated only where needed
--   • rls_policy_always_true on contract_audit_events: narrow to require
--     actor_profile_id = auth.uid()
-- (extension_in_public for citext is left as-is; moving citext out of
--  public would break existing column types and is a known acceptable
--  warning per Supabase docs.)

-- 1. Pin search_path on functions (idempotent re-create with the setting)
alter function public.touch_updated_at() set search_path = public;
alter function public.enforce_approval_maker_checker() set search_path = public;
alter function public.enforce_dd_maker_checker() set search_path = public;
alter function public.enforce_template_immutable() set search_path = public;
alter function public.enforce_contract_status_forward() set search_path = public;
alter function public.enforce_contract_sealed_immutable() set search_path = public;
alter function public.next_pre_approval_serial() set search_path = public;
alter function public.branch_loan_seq_name(text) set search_path = public;
alter function public.ensure_branch_loan_seq(text) set search_path = public;
alter function public.next_loan_no(text) set search_path = public;
alter function public.next_application_no(text) set search_path = public;

-- 2. Lock down anon access to security-definer helpers
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.current_user_branch() from anon;
revoke execute on function public.current_user_employer() from anon;
revoke execute on function public.has_role(public.user_role[]) from anon;
revoke execute on function public.is_richmond_staff() from anon;
revoke execute on function public.is_master_admin() from anon;
revoke execute on function public.is_auditor() from anon;
revoke execute on function public.write_audit(text, text, uuid, jsonb, jsonb) from anon;
revoke execute on function public.audit_row_changes() from anon, authenticated;
revoke execute on function public.write_audit(text, text, uuid, jsonb, jsonb) from authenticated;

-- 3. Tighten the contract_audit_events INSERT policy to require actor == self
drop policy if exists contract_audit_events_insert_authenticated on public.contract_audit_events;
create policy contract_audit_events_insert_self on public.contract_audit_events
  for insert to authenticated
  with check (
    actor_profile_id = auth.uid()
    or public.is_richmond_staff()
  );
