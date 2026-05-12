-- Phase 1 / 13 — Sequences and identifier helpers + audit-log trigger.

-- Pre-approval form serial. Format: RFS{0|1}NNNNN where the first digit is
-- always 0 in the legacy spreadsheet ('RFS0####'); we keep that for parity.
create sequence if not exists public.pre_approval_serial_seq start 10000 minvalue 10000 maxvalue 99999;

create or replace function public.next_pre_approval_serial()
returns text
language sql
volatile
as $$
  select 'RFS0' || lpad(nextval('public.pre_approval_serial_seq')::text, 5, '0');
$$;

-- Branch-scoped loan number sequence. We allocate one sequence per branch_code
-- on demand. Format: RFL{branchCode}{seq6} where seq6 is zero-padded to 6.
-- create_branch_loan_seq is idempotent and returns the sequence name.
create or replace function public.branch_loan_seq_name(branch_code text)
returns text
language sql
immutable
as $$
  select 'loan_no_seq_' || lower(branch_code);
$$;

create or replace function public.ensure_branch_loan_seq(branch_code text)
returns void
language plpgsql
as $$
declare
  v_name text := public.branch_loan_seq_name(branch_code);
begin
  execute format(
    'create sequence if not exists public.%I start 1 minvalue 1 maxvalue 999999',
    v_name
  );
end;
$$;

create or replace function public.next_loan_no(branch_code text)
returns text
language plpgsql
as $$
declare
  v_name text := public.branch_loan_seq_name(branch_code);
  v_next bigint;
begin
  perform public.ensure_branch_loan_seq(branch_code);
  execute format('select nextval(''public.%I'')', v_name) into v_next;
  return 'RFL' || upper(branch_code) || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.next_application_no(branch_code text)
returns text
language sql
volatile
as $$
  select public.next_loan_no(branch_code);
$$;

comment on function public.next_loan_no(text) is
  'Allocates the next RFL{branchCode}{6-digit-seq} loan number for a given branch.';
comment on function public.next_pre_approval_serial() is
  'Allocates the next RFS0##### pre-approval form serial (mirrors legacy xlsm).';

-- ─── Generic audit-log writer (SECURITY DEFINER so it can bypass RLS).

create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
$$;

-- Generic audit-on-update trigger. Tables that opt in attach this trigger.
create or replace function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(
      tg_op,
      tg_table_name,
      coalesce((new::jsonb ->> 'id')::uuid, null),
      null,
      to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.write_audit(
      tg_op,
      tg_table_name,
      coalesce((new::jsonb ->> 'id')::uuid, null),
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;
  return null;
end;
$$;

-- Apply audit triggers to state-bearing tables
create trigger trg_audit_loan_applications
after insert or update on public.loan_applications
for each row execute function public.audit_row_changes();

create trigger trg_audit_approvals
after insert or update on public.approvals
for each row execute function public.audit_row_changes();

create trigger trg_audit_loans
after insert or update on public.loans
for each row execute function public.audit_row_changes();

create trigger trg_audit_repayments
after insert or update on public.repayments
for each row execute function public.audit_row_changes();

create trigger trg_audit_contracts
after insert or update on public.contracts
for each row execute function public.audit_row_changes();

create trigger trg_audit_due_diligence_signoffs
after insert or update on public.due_diligence_signoffs
for each row execute function public.audit_row_changes();
