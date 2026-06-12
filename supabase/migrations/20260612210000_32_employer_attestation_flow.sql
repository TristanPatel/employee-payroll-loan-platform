-- ============================================================================
-- Migration 32 — parallel employer attestation
--
-- The employer is NOT an approval gate in the Richmond credit workflow.
-- Instead, when an application is submitted, an attestation request is
-- created in parallel: the employer's signatory confirms (a) employment +
-- salary and (b) commitment to remit the monthly deduction. Richmond's
-- CSE/L1/L2/L3 chain proceeds independently; the only coupling is that the
-- FINAL transition to status='approved' requires a confirmed attestation.
--
-- Privacy: the attestation row carries only name / employee no / salary /
-- proposed deduction — never the purpose, debts, or bank details.
-- ============================================================================

create table public.employer_attestations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.loan_applications(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete restrict,
  status text not null default 'pending'
    constraint employer_attestations_status_valid check (status in ('pending','confirmed','declined')),
  -- privacy-minimal snapshot shown to the employer
  application_no_snapshot text,
  employee_name_snapshot text,
  employee_no_snapshot text,
  basic_salary_ngwee bigint,
  monthly_deduction_ngwee bigint,
  tenure_months smallint,
  -- lifecycle
  requested_at timestamptz not null default now(),
  reminded_at timestamptz,
  attested_by uuid references public.profiles(id) on delete set null,
  attested_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employer_attestations enable row level security;

create policy attestations_select_staff on public.employer_attestations
  for select to authenticated using (is_richmond_staff());

create policy attestations_select_employer on public.employer_attestations
  for select to authenticated
  using (
    has_role(array['employer_admin','employer_signatory']::user_role[])
    and employer_id = current_user_employer()
  );

-- Borrower can see the status of their own attestation (no extra data leak —
-- it is their own application).
create policy attestations_select_owner on public.employer_attestations
  for select to authenticated
  using (
    application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
  );

create trigger trg_attestations_touch before update on public.employer_attestations
  for each row execute function public.touch_updated_at();
create trigger trg_audit_attestations after insert or update on public.employer_attestations
  for each row execute function public.audit_row_changes();

-- ── Auto-create the attestation when an application is submitted ────────────
create or replace function public.app_request_employer_attestation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_emp public.employees%rowtype;
  v_name text;
  v_deduction bigint;
  r record;
begin
  if new.status <> 'submitted' then return new; end if;
  if exists (select 1 from public.employer_attestations where application_id = new.id) then
    return new;
  end if;

  select * into v_emp from public.employees where id = new.employee_id;
  select full_name into v_name from public.profiles where id = v_emp.profile_id;

  -- straight-line instalment: principal × (1 + rate × tenure) ÷ tenure
  v_deduction := round(
    new.requested_amount_ngwee::numeric
    * (1 + new.monthly_interest_rate * new.requested_tenure_months)
    / new.requested_tenure_months
  );

  insert into public.employer_attestations (
    application_id, employer_id, application_no_snapshot,
    employee_name_snapshot, employee_no_snapshot,
    basic_salary_ngwee, monthly_deduction_ngwee, tenure_months
  ) values (
    new.id, new.employer_id, new.application_no,
    v_name, v_emp.employee_no,
    v_emp.salary_basic_ngwee, v_deduction, new.requested_tenure_months
  );

  for r in
    select id from public.profiles
     where role in ('employer_admin','employer_signatory')
       and employer_id = new.employer_id
       and is_active and deleted_at is null
  loop
    perform public.notify(
      r.id, 'employer_attestation_requested',
      jsonb_build_object(
        'application_id', new.id,
        'application_no', new.application_no,
        'employee_name', v_name,
        'monthly_deduction_ngwee', v_deduction
      )
    );
  end loop;
  return new;
end;
$$;

create trigger trg_app_request_attestation
  after insert or update of status on public.loan_applications
  for each row execute function public.app_request_employer_attestation();

-- ── Employer records their decision ─────────────────────────────────────────
create or replace function public.record_employer_attestation(
  p_application_id uuid,
  p_decision text,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role user_role;
  v_att public.employer_attestations%rowtype;
  v_borrower uuid;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('employer_admin','employer_signatory') then
    raise exception 'role % cannot attest', v_role using errcode='42501';
  end if;
  if p_decision not in ('confirmed','declined') then
    raise exception 'decision must be confirmed or declined' using errcode='22023';
  end if;

  select * into v_att from public.employer_attestations
   where application_id = p_application_id for update;
  if not found then
    raise exception 'no attestation request for application %', p_application_id using errcode='P0002';
  end if;
  if v_att.employer_id <> public.current_user_employer() then
    raise exception 'attestation belongs to a different employer' using errcode='42501';
  end if;
  if v_att.status <> 'pending' then
    raise exception 'attestation already %', v_att.status using errcode='22023';
  end if;
  if p_decision = 'declined' and coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required when declining' using errcode='22023';
  end if;

  update public.employer_attestations
     set status = p_decision,
         attested_by = auth.uid(),
         attested_at = now(),
         decline_reason = case when p_decision='declined' then p_reason else null end
   where id = v_att.id;

  select p.id into v_borrower
    from public.loan_applications la
    join public.employees e on e.id = la.employee_id
    join public.profiles p on p.id = e.profile_id
   where la.id = p_application_id;

  perform public.notify(
    v_borrower,
    case when p_decision='confirmed' then 'employer_confirmed' else 'employer_declined' end,
    jsonb_build_object('application_id', p_application_id,
                       'application_no', v_att.application_no_snapshot,
                       'reason', p_reason)
  );
  perform public.notify(
    (select id from public.profiles where role in ('cse','branch_manager')
      order by created_at limit 1),
    case when p_decision='confirmed' then 'employer_confirmed' else 'employer_declined' end,
    jsonb_build_object('application_id', p_application_id,
                       'application_no', v_att.application_no_snapshot),
    array['in_app']::notification_channel[]
  );
end;
$$;

revoke execute on function public.record_employer_attestation(uuid, text, text) from public;
revoke execute on function public.record_employer_attestation(uuid, text, text) from anon;
grant execute on function public.record_employer_attestation(uuid, text, text) to authenticated, service_role;

-- ── Gate: final approval requires a confirmed attestation ───────────────────
-- record_approval is recreated with the attestation gate added just before
-- the transition to 'approved'. (Body otherwise identical to migration 21.)
CREATE OR REPLACE FUNCTION public.record_approval(p_application_id uuid, p_tier approval_tier, p_decision approval_decision, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role user_role;
  v_app public.loan_applications%rowtype;
  v_prev_approver_ids uuid[];
  v_approval_id uuid;
  v_next_status application_status;
  v_required_tier approval_tier;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'no profile for caller' using errcode = '42501';
  end if;

  if p_tier = 'l1' and v_role not in ('approver_l1','branch_manager','master_admin') then
    raise exception 'role % cannot approve at l1', v_role using errcode = '42501';
  elsif p_tier = 'l2' and v_role not in ('approver_l2','branch_manager','master_admin') then
    raise exception 'role % cannot approve at l2', v_role using errcode = '42501';
  elsif p_tier = 'l3' and v_role not in ('cfo','master_admin') then
    raise exception 'role % cannot approve at l3', v_role using errcode = '42501';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then
    raise exception 'application % not found', p_application_id using errcode = 'P0002';
  end if;

  if p_tier = 'l1' and v_app.status <> 'l1_pending' then
    raise exception 'l1 approval requires status=l1_pending (currently %)', v_app.status using errcode = '22023';
  elsif p_tier = 'l2' and v_app.status <> 'l2_pending' then
    raise exception 'l2 approval requires status=l2_pending (currently %)', v_app.status using errcode = '22023';
  elsif p_tier = 'l3' and v_app.status <> 'l3_pending' then
    raise exception 'l3 approval requires status=l3_pending (currently %)', v_app.status using errcode = '22023';
  end if;

  if v_app.created_by = auth.uid() then
    raise exception 'maker-checker violation: cannot approve own application' using errcode = '42501';
  end if;
  select coalesce(array_agg(approver_id), array[]::uuid[])
    into v_prev_approver_ids
    from public.approvals
   where application_id = p_application_id and deleted_at is null;
  if auth.uid() = any(v_prev_approver_ids) then
    raise exception 'maker-checker violation: already approved at a prior tier' using errcode = '42501';
  end if;

  v_required_tier := v_app.tier;
  if v_required_tier is null then v_required_tier := 'l1'; end if;

  insert into public.approvals (application_id, tier, approver_id, decision, notes, decided_at)
  values (p_application_id, p_tier, auth.uid(), p_decision, p_notes, now())
  returning id into v_approval_id;

  if p_decision = 'reject' then
    v_next_status := 'rejected';
  elsif p_decision = 'request_info' then
    v_next_status := 'cse_review';
  else
    if p_tier = 'l1' then
      if v_required_tier in ('l2','l3') then
        v_next_status := 'l2_pending';
      else
        v_next_status := 'approved';
      end if;
    elsif p_tier = 'l2' then
      if v_required_tier = 'l3' then
        v_next_status := 'l3_pending';
      else
        v_next_status := 'approved';
      end if;
    else
      v_next_status := 'approved';
    end if;
  end if;

  -- Parallel employer attestation gate: the credit chain runs independently,
  -- but the application cannot reach final approval until the employer has
  -- confirmed employment + payroll deduction. Declined attestation blocks too.
  if v_next_status = 'approved' then
    if exists (select 1 from public.employer_attestations
                where application_id = p_application_id and status = 'declined') then
      raise exception 'employer declined the payroll-deduction attestation; resolve with the employer before final approval'
        using errcode = '22023';
    end if;
    if not exists (select 1 from public.employer_attestations
                    where application_id = p_application_id and status = 'confirmed') then
      raise exception 'employer attestation is still pending; final approval requires the employer to confirm employment and payroll deduction'
        using errcode = '22023';
    end if;
  end if;

  update public.loan_applications
     set status = v_next_status,
         decision_at = case when v_next_status in ('approved','rejected') then now()
                            else decision_at end,
         decision_reason = case when v_next_status in ('approved','rejected') then coalesce(p_notes, decision_reason)
                                 else decision_reason end
   where id = p_application_id;

  perform public.notify(
    (select p.id from public.employees e join public.profiles p on p.id = e.profile_id
      where e.id = v_app.employee_id),
    case when v_next_status = 'approved' then 'application_approved'
         when v_next_status = 'rejected' then 'application_rejected'
         else 'approval_progress' end,
    jsonb_build_object(
      'application_id', p_application_id,
      'application_no', v_app.application_no,
      'tier', p_tier,
      'decision', p_decision,
      'next_status', v_next_status
    )
  );

  return v_approval_id;
end;
$function$;
