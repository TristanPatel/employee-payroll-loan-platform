-- The per-branch loan-number sequence helpers create + bump sequences in
-- schema public. Without SECURITY DEFINER they execute as the calling role,
-- and an authenticated borrower role has neither CREATE on public nor USAGE
-- on the dynamic sequences. submitApplication therefore fails with
-- "permission denied for schema public" when calling next_application_no.
--
-- These helpers don't take user-controlled data that could be abused under
-- definer rights (branch_code is checked against an existing branch by the
-- caller). Make them SECURITY DEFINER and re-grant EXECUTE.

create or replace function public.ensure_branch_loan_seq(branch_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_name text := public.branch_loan_seq_name(branch_code);
begin
  execute format('create sequence if not exists public.%I start 1 minvalue 1 maxvalue 999999', v_name);
end;
$$;

create or replace function public.next_loan_no(branch_code text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_name text := public.branch_loan_seq_name(branch_code); v_next bigint;
begin
  perform public.ensure_branch_loan_seq(branch_code);
  execute format('select nextval(''public.%I'')', v_name) into v_next;
  return 'RFL' || upper(branch_code) || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.next_application_no(branch_code text)
returns text
language sql
security definer
set search_path to 'public'
as $$
  select public.next_loan_no(branch_code);
$$;

grant execute on function public.ensure_branch_loan_seq(text) to authenticated;
grant execute on function public.next_loan_no(text)         to authenticated;
grant execute on function public.next_application_no(text)  to authenticated;
