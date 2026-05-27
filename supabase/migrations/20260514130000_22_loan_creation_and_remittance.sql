-- ============================================================================
-- 22_loan_creation_and_remittance.sql
--
-- Phase 6 — Loan lifecycle:
--   • create_loan_from_application()         (called on approval)
--   • generate_loan_schedule()                (called by create_loan)
--   • record_disbursement()                   (accounts records bank transfer)
--   • generate_remittance_batch(employer, period_year, period_month)
--   • mark_remittance_sent / received / reconciled
--
-- Amortization model: flat-rate (Zambia-standard for payroll loans).
--   monthly_interest_total = principal × monthly_rate × tenure
--   total_collectable      = principal + monthly_interest_total
--   monthly_installment    = total_collectable / tenure   (rounded to ngwee)
--   monthly_principal      = principal / tenure
--   monthly_interest       = principal × monthly_rate
--   disbursed_amount       = principal − admin_fee − insurance_fee
-- ============================================================================

-- A) Idempotent loan_no sequence
create sequence if not exists public.loan_no_seq start 100000;

create or replace function public.next_loan_no()
returns text language sql security definer set search_path = public as $$
  select 'RF-LN-' || lpad(nextval('public.loan_no_seq')::text, 6, '0');
$$;
grant execute on function public.next_loan_no() to authenticated;

-- B) Schedule generator -------------------------------------------------------
create or replace function public.generate_loan_schedule(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan public.loans%rowtype;
  v_monthly_principal bigint;
  v_monthly_interest bigint;
  v_remaining_principal bigint;
  v_remaining_interest bigint;
  i int;
  v_due_date date;
  v_p bigint;
  v_int bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan % not found', p_loan_id; end if;

  -- Idempotency
  if exists (select 1 from public.loan_schedule where loan_id = p_loan_id) then return; end if;

  v_monthly_principal := round(v_loan.principal_ngwee::numeric / v_loan.tenure_months);
  v_monthly_interest  := round(v_loan.principal_ngwee::numeric * v_loan.monthly_interest_rate);

  v_remaining_principal := v_loan.principal_ngwee;
  v_remaining_interest  := v_loan.total_interest_ngwee;

  for i in 1..v_loan.tenure_months loop
    v_due_date := (v_loan.start_date + (i || ' months')::interval)::date;

    if i = v_loan.tenure_months then
      -- Final instalment absorbs any rounding residual
      v_p   := v_remaining_principal;
      v_int := v_remaining_interest;
    else
      v_p   := v_monthly_principal;
      v_int := v_monthly_interest;
    end if;

    insert into public.loan_schedule
      (loan_id, instalment_no, due_date, scheduled_amount_ngwee,
       principal_component_ngwee, interest_component_ngwee, status)
    values
      (p_loan_id, i, v_due_date, v_p + v_int, v_p, v_int, 'scheduled');

    v_remaining_principal := v_remaining_principal - v_p;
    v_remaining_interest  := v_remaining_interest  - v_int;
  end loop;
end;
$$;
grant execute on function public.generate_loan_schedule(uuid) to authenticated;

-- C) Loan creation on approval ----------------------------------------------
create or replace function public.create_loan_from_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.loan_applications%rowtype;
  v_loan_id uuid;
  v_admin_fee bigint;
  v_insurance_fee bigint;
  v_total_interest bigint;
  v_total_collectable bigint;
  v_monthly_inst bigint;
  v_disbursed bigint;
  v_loan_no text;
  v_start date;
  v_end date;
begin
  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then raise exception 'application % not found', p_application_id; end if;
  if v_app.status <> 'approved' then
    raise exception 'application status is %; must be approved', v_app.status using errcode='22023';
  end if;
  -- Idempotency
  if exists (select 1 from public.loans where application_id = p_application_id) then
    return (select id from public.loans where application_id = p_application_id limit 1);
  end if;

  v_admin_fee     := round(v_app.requested_amount_ngwee::numeric * v_app.admin_fee_pct);
  v_insurance_fee := round(v_app.requested_amount_ngwee::numeric * v_app.insurance_fee_pct);
  v_total_interest := round(
    v_app.requested_amount_ngwee::numeric
    * v_app.monthly_interest_rate
    * v_app.requested_tenure_months
  );
  v_total_collectable := v_app.requested_amount_ngwee + v_total_interest;
  v_monthly_inst      := round(v_total_collectable::numeric / v_app.requested_tenure_months);
  v_disbursed         := v_app.requested_amount_ngwee - v_admin_fee - v_insurance_fee;

  v_start := coalesce(v_app.start_date_preferred,
                      (date_trunc('month', now() at time zone 'Africa/Lusaka')
                       + interval '1 month')::date);
  v_end   := (v_start + (v_app.requested_tenure_months || ' months')::interval)::date;

  v_loan_no := public.next_loan_no();

  insert into public.loans (
    application_id, loan_no, employee_id, employer_id, branch_id,
    product, principal_ngwee, monthly_interest_rate, tenure_months,
    admin_fee_ngwee, insurance_fee_ngwee, total_interest_ngwee,
    total_collectable_ngwee, monthly_installment_ngwee,
    disbursed_amount_ngwee, current_outstanding_ngwee,
    start_date, end_date, status, created_by
  ) values (
    v_app.id, v_loan_no, v_app.employee_id, v_app.employer_id, v_app.branch_id,
    v_app.product, v_app.requested_amount_ngwee, v_app.monthly_interest_rate,
    v_app.requested_tenure_months, v_admin_fee, v_insurance_fee, v_total_interest,
    v_total_collectable, v_monthly_inst,
    v_disbursed, v_total_collectable,
    v_start, v_end, 'pending_disbursement', auth.uid()
  )
  returning id into v_loan_id;

  perform public.generate_loan_schedule(v_loan_id);

  -- Notify borrower
  perform public.notify(
    (select p.id from public.employees e join public.profiles p on p.id = e.profile_id
      where e.id = v_app.employee_id),
    'loan_created',
    jsonb_build_object(
      'loan_id', v_loan_id, 'loan_no', v_loan_no,
      'principal_ngwee', v_app.requested_amount_ngwee,
      'monthly_installment_ngwee', v_monthly_inst,
      'tenure_months', v_app.requested_tenure_months,
      'start_date', v_start
    )
  );

  return v_loan_id;
end;
$$;
grant execute on function public.create_loan_from_application(uuid) to authenticated;

-- D) Trigger: auto-create loan when application is approved -----------------
create or replace function public.app_create_loan_on_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.create_loan_from_application(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_app_create_loan_on_approval on public.loan_applications;
create trigger trg_app_create_loan_on_approval
  after update of status on public.loan_applications
  for each row execute function public.app_create_loan_on_approval();

-- E) Disbursement ------------------------------------------------------------
create or replace function public.record_disbursement(
  p_loan_id uuid,
  p_method text,           -- 'bank_transfer' | 'mobile_money'
  p_reference text,        -- bank ref / momo txn id
  p_authorised_by uuid     -- the L2/CFO who authorised (maker-checker)
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_loan public.loans%rowtype;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin') then
    raise exception 'role % cannot record disbursement', v_role using errcode = '42501';
  end if;

  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan % not found', p_loan_id; end if;
  if v_loan.status <> 'pending_disbursement' then
    raise exception 'loan status is %; must be pending_disbursement', v_loan.status using errcode='22023';
  end if;

  -- Maker-checker for disbursement: authorising user must NOT be the
  -- accounts officer recording it.
  if p_authorised_by = auth.uid() then
    raise exception 'maker-checker: authoriser must differ from recorder' using errcode='42501';
  end if;
  if p_authorised_by is null then
    raise exception 'authoriser is required' using errcode='22023';
  end if;

  update public.loans
     set status = 'active',
         disbursement_method = p_method,
         disbursement_ref = p_reference,
         disbursed_at = now(),
         disbursed_by = auth.uid(),
         disbursement_authorised_by = p_authorised_by
   where id = p_loan_id;

  -- Notify borrower
  perform public.notify(
    (select p.id from public.employees e join public.profiles p on p.id = e.profile_id
      where e.id = v_loan.employee_id),
    'loan_disbursed',
    jsonb_build_object(
      'loan_id', p_loan_id, 'loan_no', v_loan.loan_no,
      'method', p_method, 'reference', p_reference,
      'amount_ngwee', v_loan.disbursed_amount_ngwee
    )
  );
end;
$$;
grant execute on function public.record_disbursement(uuid, text, text, uuid) to authenticated;

-- F) Remittance batch generation --------------------------------------------
create or replace function public.generate_remittance_batch(
  p_employer_id uuid,
  p_year smallint,
  p_month smallint
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_batch_id uuid;
  v_total bigint;
  v_count int;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin','branch_manager') then
    raise exception 'role % cannot generate remittance', v_role using errcode='42501';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'invalid month %', p_month using errcode='22023';
  end if;

  -- Idempotency: one batch per (employer, period)
  select id into v_batch_id from public.remittance_batches
   where employer_id = p_employer_id
     and period_year = p_year
     and period_month = p_month
     and deleted_at is null;
  if v_batch_id is not null then return v_batch_id; end if;

  -- Pull all scheduled deductions falling inside the period for active
  -- loans of the employer. We use due_date's month/year.
  select
    coalesce(sum(s.scheduled_amount_ngwee), 0),
    count(distinct l.id)
    into v_total, v_count
  from public.loan_schedule s
  join public.loans l on l.id = s.loan_id
  where l.employer_id = p_employer_id
    and l.status = 'active'
    and s.deleted_at is null
    and s.status in ('scheduled','partial')
    and extract(month from s.due_date) = p_month
    and extract(year from s.due_date) = p_year;

  insert into public.remittance_batches (
    employer_id, period_month, period_year,
    total_amount_ngwee, employee_count, status, created_by
  ) values (
    p_employer_id, p_month, p_year, v_total, v_count, 'draft', auth.uid()
  )
  returning id into v_batch_id;

  return v_batch_id;
end;
$$;
grant execute on function public.generate_remittance_batch(uuid, smallint, smallint) to authenticated;

-- G) Remittance state transitions -------------------------------------------
create or replace function public.mark_remittance_sent(p_batch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin') then
    raise exception 'role % cannot send remittance', v_role using errcode='42501';
  end if;
  update public.remittance_batches
     set status = 'sent', sent_at = now()
   where id = p_batch_id and status = 'draft';
end;
$$;
grant execute on function public.mark_remittance_sent(uuid) to authenticated;

create or replace function public.mark_remittance_received(
  p_batch_id uuid,
  p_received_amount_ngwee bigint,
  p_bank_ref text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_batch public.remittance_batches%rowtype;
  v_new_status remittance_status;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin') then
    raise exception 'role % cannot record receipt', v_role using errcode='42501';
  end if;
  select * into v_batch from public.remittance_batches where id = p_batch_id;
  if not found then raise exception 'batch % not found', p_batch_id; end if;

  if p_received_amount_ngwee >= v_batch.total_amount_ngwee then
    v_new_status := 'fully_received';
  elsif p_received_amount_ngwee > 0 then
    v_new_status := 'partially_received';
  else
    raise exception 'received amount must be > 0' using errcode='22023';
  end if;

  update public.remittance_batches
     set status = v_new_status,
         received_at = now(),
         notes = coalesce(notes, '') || E'\nbank_ref=' || p_bank_ref ||
                 ' received_ngwee=' || p_received_amount_ngwee
   where id = p_batch_id;
end;
$$;
grant execute on function public.mark_remittance_received(uuid, bigint, text) to authenticated;

-- H) RLS for loans / loan_schedule / remittance_batches: borrower-self read,
-- staff full access. Inserts only via RPC.
do $$ begin
  if not exists (select 1 from pg_policy where polname='loans_select_owner' and polrelid='public.loans'::regclass) then
    create policy loans_select_owner on public.loans
      for select using (employee_id in (
        select id from public.employees where profile_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policy where polname='loans_select_staff' and polrelid='public.loans'::regclass) then
    create policy loans_select_staff on public.loans
      for select using (is_richmond_staff());
  end if;
  if not exists (select 1 from pg_policy where polname='loan_schedule_select_owner' and polrelid='public.loan_schedule'::regclass) then
    create policy loan_schedule_select_owner on public.loan_schedule
      for select using (loan_id in (
        select l.id from public.loans l
        join public.employees e on e.id = l.employee_id
        where e.profile_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policy where polname='loan_schedule_select_staff' and polrelid='public.loan_schedule'::regclass) then
    create policy loan_schedule_select_staff on public.loan_schedule
      for select using (is_richmond_staff());
  end if;
  if not exists (select 1 from pg_policy where polname='remittance_batches_select_staff' and polrelid='public.remittance_batches'::regclass) then
    create policy remittance_batches_select_staff on public.remittance_batches
      for select using (is_richmond_staff());
  end if;
end $$;
