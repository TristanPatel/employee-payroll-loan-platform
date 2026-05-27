-- ============================================================================
-- 23_repayment_reconciliation.sql
--
-- Phase 7 — Closing the loan-servicing loop:
--   • record_repayment()              — capture an actual incoming deduction
--                                       against a specific schedule line,
--                                       update outstanding balance + line
--                                       status, auto-settle the loan when
--                                       the full collectable has been paid.
--   • recompute_arrears()             — flag overdue scheduled lines and
--                                       flip the loan into 'in_arrears' if
--                                       it has any missed instalments.
--   • close_loan(loan_id, reason)     — record the loan_closures row and
--                                       move the loan to 'settled' (or
--                                       'written_off' on policy override).
--   • schedule_notification_worker()  — pg_cron job that POSTs to the
--                                       notification-worker Edge Function
--                                       every 5 minutes.
-- ============================================================================

-- A) Record a repayment against a schedule line -----------------------------
create or replace function public.record_repayment(
  p_loan_id uuid,
  p_schedule_id uuid,
  p_amount_ngwee bigint,
  p_payment_date date,
  p_bank_reference text,
  p_remittance_batch_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_loan public.loans%rowtype;
  v_line public.loan_schedule%rowtype;
  v_already_paid bigint;
  v_new_outstanding bigint;
  v_repayment_id uuid;
  v_line_total bigint;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin') then
    raise exception 'role % cannot record repayment', v_role using errcode='42501';
  end if;
  if p_amount_ngwee <= 0 then
    raise exception 'amount must be positive' using errcode='22023';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception 'loan % not found', p_loan_id; end if;
  if v_loan.status not in ('active','in_arrears') then
    raise exception 'loan status is %; not collectable', v_loan.status using errcode='22023';
  end if;

  select * into v_line from public.loan_schedule where id = p_schedule_id for update;
  if not found then raise exception 'schedule line % not found', p_schedule_id; end if;
  if v_line.loan_id <> p_loan_id then
    raise exception 'schedule line belongs to a different loan' using errcode='22023';
  end if;

  -- Insert the repayment record
  insert into public.repayments (
    loan_id, schedule_id, employer_id, amount_ngwee, payment_date,
    deduction_period_month, deduction_period_year,
    bank_reference, remittance_batch_id, captured_by
  ) values (
    p_loan_id, p_schedule_id, v_loan.employer_id, p_amount_ngwee, p_payment_date,
    extract(month from p_payment_date)::smallint,
    extract(year from p_payment_date)::smallint,
    p_bank_reference, p_remittance_batch_id, auth.uid()
  )
  returning id into v_repayment_id;

  -- Update the schedule line status based on cumulative payments
  select coalesce(sum(amount_ngwee),0) into v_already_paid
    from public.repayments
   where schedule_id = p_schedule_id and deleted_at is null;
  v_line_total := v_line.scheduled_amount_ngwee;

  update public.loan_schedule
     set status = case
       when v_already_paid >= v_line_total then 'deducted'::schedule_status
       when v_already_paid > 0             then 'partial'::schedule_status
       else status
     end
   where id = p_schedule_id;

  -- Decrement the loan's outstanding balance
  v_new_outstanding := greatest(v_loan.current_outstanding_ngwee - p_amount_ngwee, 0);
  update public.loans
     set current_outstanding_ngwee = v_new_outstanding,
         status = case
           when v_new_outstanding = 0 then 'settled'::loan_status
           else status
         end
   where id = p_loan_id;

  -- Notify borrower
  perform public.notify(
    (select p.id from public.employees e join public.profiles p on p.id = e.profile_id
      where e.id = v_loan.employee_id),
    case when v_new_outstanding = 0 then 'loan_settled' else 'repayment_received' end,
    jsonb_build_object(
      'loan_id', p_loan_id, 'loan_no', v_loan.loan_no,
      'amount_ngwee', p_amount_ngwee,
      'outstanding_ngwee', v_new_outstanding,
      'instalment_no', v_line.instalment_no
    )
  );

  return v_repayment_id;
end;
$$;
grant execute on function public.record_repayment(uuid, uuid, bigint, date, text, uuid) to authenticated;

-- B) Recompute arrears across all active loans ------------------------------
create or replace function public.recompute_arrears()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_today date := (now() at time zone 'Africa/Lusaka')::date;
  v_missed_count int := 0;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is not null and v_role not in ('accounts','master_admin','branch_manager','cfo','auditor') then
    raise exception 'role % cannot run arrears scan', v_role using errcode='42501';
  end if;

  -- Flag any past-due 'scheduled' line as 'missed'.
  with bumped as (
    update public.loan_schedule
       set status = 'missed'::schedule_status
     where status = 'scheduled'
       and due_date < v_today
       and deleted_at is null
    returning loan_id
  )
  select count(distinct loan_id) into v_missed_count from bumped;

  -- Flip any loan that now has missed instalments to 'in_arrears'.
  update public.loans l
     set status = 'in_arrears'::loan_status
   where status = 'active'
     and exists (
       select 1 from public.loan_schedule s
        where s.loan_id = l.id and s.status = 'missed' and s.deleted_at is null
     );

  -- Conversely, if a loan is in_arrears but no longer has missed lines
  -- (because someone captured a late payment), move it back to active.
  update public.loans l
     set status = 'active'::loan_status
   where status = 'in_arrears'
     and not exists (
       select 1 from public.loan_schedule s
        where s.loan_id = l.id and s.status = 'missed' and s.deleted_at is null
     )
     and current_outstanding_ngwee > 0;

  return v_missed_count;
end;
$$;
grant execute on function public.recompute_arrears() to authenticated;

-- C) Loan closure -----------------------------------------------------------
create or replace function public.close_loan(
  p_loan_id uuid,
  p_closure_reason text,
  p_force_write_off boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_loan public.loans%rowtype;
  v_closure_id uuid;
  v_fully_paid boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','cfo','master_admin') then
    raise exception 'role % cannot close loans', v_role using errcode='42501';
  end if;
  if p_force_write_off and v_role not in ('cfo','master_admin') then
    raise exception 'write-off requires cfo or master_admin' using errcode='42501';
  end if;

  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan % not found', p_loan_id; end if;

  v_fully_paid := (v_loan.current_outstanding_ngwee = 0);

  if not v_fully_paid and not p_force_write_off then
    raise exception 'loan has outstanding balance of % ngwee — pass p_force_write_off=true to force closure', v_loan.current_outstanding_ngwee using errcode='22023';
  end if;

  insert into public.loan_closures (
    loan_id, employment_status, loan_fully_paid, interest_settled,
    no_outstanding_penalties, loan_book_updated, checked_by, checked_at,
    approved_by, approved_at, closure_reason, created_by
  ) values (
    p_loan_id,
    'permanent'::employment_status,
    v_fully_paid, v_fully_paid, true, true,
    auth.uid(), now(),
    auth.uid(), now(),
    p_closure_reason, auth.uid()
  )
  returning id into v_closure_id;

  update public.loans
     set status = case when p_force_write_off then 'written_off'::loan_status
                       else 'settled'::loan_status end
   where id = p_loan_id;

  perform public.notify(
    (select p.id from public.employees e join public.profiles p on p.id = e.profile_id
      where e.id = v_loan.employee_id),
    case when p_force_write_off then 'loan_written_off' else 'loan_closed' end,
    jsonb_build_object('loan_id', p_loan_id, 'loan_no', v_loan.loan_no,
                       'closure_reason', p_closure_reason)
  );

  return v_closure_id;
end;
$$;
grant execute on function public.close_loan(uuid, text, boolean) to authenticated;

-- D) Schedule the notification-worker via pg_cron ---------------------------
-- pg_cron is preinstalled on Supabase. We POST to the function URL using
-- the service-role key. Job key is namespaced so re-running this migration
-- replaces the schedule cleanly.

do $$
declare v_url text; v_key text;
begin
  -- Skip if pg_cron / pg_net are not available (e.g. local dev shadow db).
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not available; skipping notification-worker schedule';
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net not available; skipping notification-worker schedule';
    return;
  end if;

  -- Unschedule any previous version of the job
  perform cron.unschedule(j.jobid)
    from cron.job j
   where j.jobname = 'notification_worker_drain';

  v_url := current_setting('app.settings.functions_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  -- Fallback to hard-coded project URL if app.* settings not configured.
  if v_url is null then
    v_url := 'https://slmrpvlhttgrhoinpfwa.supabase.co/functions/v1/notification-worker';
  end if;

  if v_key is null then
    raise notice 'service_role key not configured in app.settings; cron job created but auth header is empty — set app.settings.service_role_key';
    v_key := '';
  end if;

  perform cron.schedule(
    'notification_worker_drain',
    '*/5 * * * *',  -- every 5 minutes
    format($q$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || %L,
                                      'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $q$, v_url, v_key)
  );
end$$;
