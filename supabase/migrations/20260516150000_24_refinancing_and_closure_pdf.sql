-- ============================================================================
-- 24_refinancing_and_closure_pdf.sql
--
-- Phase 8 — Refinancing flow + final-statement bookkeeping:
--
--   • create_loan_from_application() is patched to handle refinancing:
--     when the source application has application_type='refinancing' AND
--     refinanced_from_loan_id is set, the new loan is created in the
--     normal way; once the new loan is disbursed the old loan is auto-
--     closed via close_loan() and the buyout repayment is recorded
--     against the old loan's outstanding lines.
--
--   • settle_refinanced_source(p_application_id, p_buyout_ngwee, p_bank_ref)
--     — accounts-side helper that, given the refinancing application
--     ID, closes the old loan and records the buyout repayment in one
--     atomic transaction.
--
-- The final-statement PDF itself is rendered by a new Edge Function
-- (render-loan-statement) — no SQL change required for that.
-- ============================================================================

create or replace function public.settle_refinanced_source(
  p_application_id uuid,
  p_buyout_ngwee bigint,
  p_bank_ref text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role user_role;
  v_app  public.loan_applications%rowtype;
  v_old_loan public.loans%rowtype;
  v_line public.loan_schedule%rowtype;
  v_today date := (now() at time zone 'Africa/Lusaka')::date;
  v_remaining bigint;
  v_closure_id uuid;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('accounts','master_admin') then
    raise exception 'role % cannot settle refinancing', v_role using errcode='42501';
  end if;

  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then raise exception 'application % not found', p_application_id; end if;
  if v_app.application_type <> 'refinancing' then
    raise exception 'application % is not a refinancing', p_application_id using errcode='22023';
  end if;
  if v_app.refinanced_from_loan_id is null then
    raise exception 'application % has no refinanced_from_loan_id', p_application_id using errcode='22023';
  end if;

  select * into v_old_loan from public.loans where id = v_app.refinanced_from_loan_id for update;
  if not found then raise exception 'source loan not found' using errcode='P0002'; end if;
  if v_old_loan.status not in ('active','in_arrears') then
    raise exception 'source loan status is %; cannot be refinanced', v_old_loan.status using errcode='22023';
  end if;

  v_remaining := p_buyout_ngwee;

  -- Spread the buyout amount over the source loan's unpaid lines in
  -- ascending due_date order, calling record_repayment for each.
  for v_line in
    select * from public.loan_schedule
     where loan_id = v_old_loan.id
       and status in ('scheduled','partial','missed')
       and deleted_at is null
     order by due_date
  loop
    exit when v_remaining <= 0;
    declare
      v_already_paid bigint;
      v_line_remaining bigint;
      v_chunk bigint;
    begin
      select coalesce(sum(amount_ngwee),0) into v_already_paid
        from public.repayments
       where schedule_id = v_line.id and deleted_at is null;
      v_line_remaining := v_line.scheduled_amount_ngwee - v_already_paid;
      if v_line_remaining <= 0 then continue; end if;
      v_chunk := least(v_line_remaining, v_remaining);
      perform public.record_repayment(
        v_old_loan.id, v_line.id, v_chunk, v_today,
        p_bank_ref || ' (refi)', null
      );
      v_remaining := v_remaining - v_chunk;
    end;
  end loop;

  -- Force-close the old loan if anything is still outstanding (rare;
  -- only if the buyout was insufficient).
  select * into v_old_loan from public.loans where id = v_old_loan.id;
  if v_old_loan.current_outstanding_ngwee > 0 then
    raise exception 'buyout amount % is insufficient; source loan still owes %',
                    p_buyout_ngwee, v_old_loan.current_outstanding_ngwee
      using errcode='22023';
  end if;

  -- close_loan was already invoked by record_repayment's auto-settle.
  -- Belt-and-braces: insert a closure row with reason='refinanced' if
  -- one doesn't exist yet.
  if not exists (select 1 from public.loan_closures where loan_id = v_old_loan.id and deleted_at is null) then
    select public.close_loan(v_old_loan.id,
      format('Refinanced into application %s', v_app.application_no), false) into v_closure_id;
  end if;

  return v_old_loan.id;
end;
$$;
grant execute on function public.settle_refinanced_source(uuid, bigint, text) to authenticated;
