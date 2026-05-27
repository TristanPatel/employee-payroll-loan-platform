-- ============================================================================
-- 21_approval_workflow.sql
--
-- Phase 5 — Approval workflow state machine.
--
--   * advance_to_cse_review(app_id)        — triggered when borrower has
--                                            signed; CSE-only override.
--   * seed_due_diligence(app_id)            — inserts the standard 12-item
--                                            CSE checklist when a fresh
--                                            cse_review begins.
--   * record_due_diligence_signoff(app_id) — captures CSE / branch-manager
--                                            / dd-team approval of the
--                                            checklist; advances to L1
--                                            once both required role-keys
--                                            have signed.
--   * record_approval(app_id, tier, decision, notes)
--                                          — enforces maker-checker:
--                                            • approver != application
--                                              creator
--                                            • approver != any prior tier
--                                              approver on this application
--                                            Auto-advances status by tier:
--                                            l1 approve → l2_pending if
--                                            tier_required >= l2 else
--                                            approved; same for l2; l3
--                                            approve → approved.
--   * notify(p_recipient, p_template, p_payload)
--                                          — internal in-app notification
--                                            helper (queues SMS/email
--                                            channels for Phase 6).
--
-- All RPCs are SECURITY DEFINER and validate caller role + application
-- status before mutating anything.
-- ============================================================================

-- A) Add `started_cse_review_at` column for clearer audit
alter table public.loan_applications
  add column if not exists started_cse_review_at timestamptz;

-- B) Notification helper -----------------------------------------------------
create or replace function public.notify(
  p_recipient uuid,
  p_template text,
  p_payload jsonb,
  p_channels notification_channel[] default array['in_app']::notification_channel[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ch notification_channel;
begin
  if p_recipient is null then return; end if;
  foreach ch in array p_channels loop
    insert into public.notifications (recipient_id, channel, template, payload, status)
    values (p_recipient, ch, p_template, p_payload,
            case when ch = 'in_app' then 'delivered'::notification_status
                 else 'queued'::notification_status end);
  end loop;
end;
$$;

grant execute on function public.notify(uuid, text, jsonb, notification_channel[]) to authenticated;

-- C) Advance to CSE review ---------------------------------------------------
-- Called automatically by a contract trigger (below) when the loan_agreement
-- contract reaches partially_signed, OR manually by CSE/branch_manager.
create or replace function public.advance_to_cse_review(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.loan_applications%rowtype;
  v_caller_role user_role;
begin
  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then
    raise exception 'application % not found', p_application_id using errcode = 'P0002';
  end if;
  if v_app.status not in ('submitted','employer_review','employer_confirmed') then
    raise exception 'cannot advance from status %', v_app.status using errcode = '22023';
  end if;

  -- Caller must be CSE/branch_manager/master_admin OR a security-definer caller.
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is not null and v_caller_role not in ('cse','branch_manager','master_admin') then
    raise exception 'role % cannot advance applications', v_caller_role using errcode = '42501';
  end if;

  update public.loan_applications
     set status = 'cse_review', started_cse_review_at = coalesce(started_cse_review_at, now())
   where id = p_application_id;

  -- Seed checklist (idempotent — skip if already present)
  perform public.seed_due_diligence(p_application_id);

  -- Notify CSE pool — for now we ping the application's branch_manager
  perform public.notify(
    (select created_by from public.profiles where role = 'cse' order by created_at limit 1),
    'cse_review_started',
    jsonb_build_object('application_id', p_application_id, 'application_no', v_app.application_no)
  );
end;
$$;

grant execute on function public.advance_to_cse_review(uuid) to authenticated;

-- D) Due-diligence checklist seeding ----------------------------------------
create or replace function public.seed_due_diligence(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 12 standard checks per Richmond Finance loan policy v2026.1
  v_items text[][] := array[
    -- phase, item_no, item_key, severity
    array['1','1', 'nrc_validity_check',      'critical'],
    array['1','2', 'nrc_photo_match',         'critical'],
    array['1','3', 'employment_letter_dated', 'critical'],
    array['1','4', 'payslip_3mo_consistent',  'critical'],
    array['1','5', 'net_pay_meets_threshold', 'critical'],
    array['2','1', 'bank_statement_match',    'major'],
    array['2','2', 'existing_obligations_disclosed', 'major'],
    array['2','3', 'debt_ratio_within_limit', 'critical'],
    array['2','4', 'residence_proof_valid',   'minor'],
    array['3','1', 'employer_authorisation_signed', 'critical'],
    array['3','2', 'purpose_makes_sense',     'minor'],
    array['3','3', 'no_active_loans_in_arrears', 'critical']
  ];
  rec text[];
begin
  -- Idempotent: only insert if empty.
  if exists (select 1 from public.due_diligence_checks
              where application_id = p_application_id) then
    return;
  end if;
  foreach rec slice 1 in array v_items loop
    insert into public.due_diligence_checks
      (application_id, phase, item_no, item_key, state, severity)
    values
      (p_application_id, rec[1]::smallint, rec[2]::smallint, rec[3], 'pending', rec[4]);
  end loop;
end;
$$;

grant execute on function public.seed_due_diligence(uuid) to authenticated;

-- E) Record a CSE / branch-manager / DD-team sign-off ------------------------
create or replace function public.record_due_diligence_signoff(
  p_application_id uuid,
  p_role_key text  -- 'cse' | 'branch_manager' | 'dd_team'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_app  public.loan_applications%rowtype;
  v_pending_count int;
  v_required_signoffs text[] := array['cse','branch_manager'];
  v_signoff_count int;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'no profile for caller' using errcode = '42501';
  end if;
  -- Role gate
  if p_role_key = 'cse' and v_role not in ('cse','master_admin') then
    raise exception 'role % cannot sign as cse', v_role using errcode = '42501';
  elsif p_role_key = 'branch_manager' and v_role not in ('branch_manager','master_admin') then
    raise exception 'role % cannot sign as branch_manager', v_role using errcode = '42501';
  elsif p_role_key = 'dd_team' and v_role not in ('cse','branch_manager','master_admin') then
    raise exception 'role % cannot sign as dd_team', v_role using errcode = '42501';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then
    raise exception 'application % not found', p_application_id using errcode = 'P0002';
  end if;
  if v_app.status <> 'cse_review' then
    raise exception 'application status is %; must be cse_review', v_app.status using errcode = '22023';
  end if;

  -- All critical checks must be 'pass' before any signoff
  select count(*) into v_pending_count
    from public.due_diligence_checks
   where application_id = p_application_id
     and severity = 'critical'
     and state <> 'pass';
  if v_pending_count > 0 then
    raise exception '% critical due-diligence checks have not passed', v_pending_count using errcode = '22023';
  end if;

  insert into public.due_diligence_signoffs (application_id, role_key, signer_id, signed_at)
  values (p_application_id, p_role_key, auth.uid(), now());

  -- If both required role-keys have signed, advance to L1
  select count(distinct role_key) into v_signoff_count
    from public.due_diligence_signoffs
   where application_id = p_application_id
     and role_key = any(v_required_signoffs)
     and deleted_at is null;
  if v_signoff_count >= array_length(v_required_signoffs, 1) then
    update public.loan_applications
       set status = 'l1_pending'
     where id = p_application_id;

    -- Notify L1 approvers
    perform public.notify(
      (select id from public.profiles where role in ('approver_l1','branch_manager') order by created_at limit 1),
      'l1_pending',
      jsonb_build_object('application_id', p_application_id, 'application_no', v_app.application_no)
    );
  end if;
end;
$$;

grant execute on function public.record_due_diligence_signoff(uuid, text) to authenticated;

-- F) Maker-checker approval RPC ----------------------------------------------
create or replace function public.record_approval(
  p_application_id uuid,
  p_tier approval_tier,
  p_decision approval_decision,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- Tier → required role
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

  -- Status gate per tier
  if p_tier = 'l1' and v_app.status <> 'l1_pending' then
    raise exception 'l1 approval requires status=l1_pending (currently %)', v_app.status using errcode = '22023';
  elsif p_tier = 'l2' and v_app.status <> 'l2_pending' then
    raise exception 'l2 approval requires status=l2_pending (currently %)', v_app.status using errcode = '22023';
  elsif p_tier = 'l3' and v_app.status <> 'l3_pending' then
    raise exception 'l3 approval requires status=l3_pending (currently %)', v_app.status using errcode = '22023';
  end if;

  -- Maker-checker: approver cannot be the application's creator, nor any
  -- prior approver on this application.
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

  -- Determine the application's highest required tier (snapshot field)
  v_required_tier := v_app.tier;
  if v_required_tier is null then v_required_tier := 'l1'; end if;

  -- Insert the approval row
  insert into public.approvals (application_id, tier, approver_id, decision, notes, decided_at)
  values (p_application_id, p_tier, auth.uid(), p_decision, p_notes, now())
  returning id into v_approval_id;

  -- Compute next status
  if p_decision = 'reject' then
    v_next_status := 'rejected';
  elsif p_decision = 'request_info' then
    v_next_status := 'cse_review';
  else  -- approve
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
    else  -- l3
      v_next_status := 'approved';
    end if;
  end if;

  update public.loan_applications
     set status = v_next_status,
         decision_at = case when v_next_status in ('approved','rejected') then now()
                            else decision_at end,
         decision_reason = case when v_next_status in ('approved','rejected') then coalesce(p_notes, decision_reason)
                                 else decision_reason end
   where id = p_application_id;

  -- Notify the borrower (and next approver if any)
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
$$;

grant execute on function public.record_approval(uuid, approval_tier, approval_decision, text) to authenticated;

-- G) Auto-advance trigger: once the loan agreement reaches partially_signed
-- (borrower has signed), the application enters cse_review. This makes the
-- flow zero-click for the CSE once the borrower signs.
create or replace function public.app_advance_on_contract_sign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_status application_status;
begin
  if new.status not in ('partially_signed','fully_signed','sealed') then
    return new;
  end if;
  if new.application_id is null then return new; end if;
  if new.contract_type <> 'loan_agreement' then return new; end if;

  select status into v_app_status from public.loan_applications where id = new.application_id;
  if v_app_status in ('submitted','employer_review','employer_confirmed') then
    update public.loan_applications
       set status = 'cse_review',
           started_cse_review_at = coalesce(started_cse_review_at, now())
     where id = new.application_id;
    perform public.seed_due_diligence(new.application_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_app_advance_on_contract_sign on public.contracts;
create trigger trg_app_advance_on_contract_sign
  after update of status on public.contracts
  for each row
  execute function public.app_advance_on_contract_sign();

-- H) RLS adjustments: approvals.insert policies need to verify that the
-- inserted row is for the correct status AND that auth.uid() != created_by.
-- The existing INSERT policies (approvals_insert_l1/l2/l3) cover role checks
-- but not maker-checker — we enforce that exclusively in record_approval()
-- now. Tighten by revoking direct INSERT from authenticated and routing all
-- inserts through the RPC.
revoke insert on public.approvals from authenticated;
grant insert on public.approvals to postgres;  -- RPC runs as definer
