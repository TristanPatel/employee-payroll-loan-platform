-- ============================================================================
-- Migration 37 — CFO P&L report
--
-- Period-bucketed lending P&L. Income is recognised on an ORIGINATION basis
-- (flat-rate interest + fees are booked when the loan disburses); cash
-- collected and write-offs are shown alongside. Granularity is 'week' or
-- 'month'. master_admin / cfo / auditor only.
-- ============================================================================
create or replace function public.cfo_pnl(p_granularity text default 'month', p_periods int default 12)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role user_role;
  v_trunc text;
  v_result jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid() and deleted_at is null;
  if v_role not in ('master_admin','cfo','auditor') then
    raise exception 'role % cannot view the P&L', v_role using errcode = '42501';
  end if;
  v_trunc := case when p_granularity = 'week' then 'week' else 'month' end;

  with periods as (
    select generate_series(
      date_trunc(v_trunc, (now() at time zone 'Africa/Lusaka')) - ((p_periods - 1) || ' ' || v_trunc)::interval,
      date_trunc(v_trunc, (now() at time zone 'Africa/Lusaka')),
      ('1 ' || v_trunc)::interval
    )::date as period_start
  ),
  orig as (
    select date_trunc(v_trunc, disbursed_at at time zone 'Africa/Lusaka')::date as p,
           count(*) as new_loans,
           coalesce(sum(disbursed_amount_ngwee),0) as principal_disbursed,
           coalesce(sum(total_interest_ngwee),0) as interest_booked,
           coalesce(sum(admin_fee_ngwee + insurance_fee_ngwee),0) as fees_booked
      from public.loans
     where disbursed_at is not null and deleted_at is null
     group by 1
  ),
  collected as (
    select date_trunc(v_trunc, payment_date::timestamp)::date as p,
           coalesce(sum(amount_ngwee),0) as cash_collected
      from public.repayments
     where deleted_at is null
     group by 1
  ),
  writeoffs as (
    select date_trunc(v_trunc, c.approved_at at time zone 'Africa/Lusaka')::date as p,
           coalesce(sum(l.current_outstanding_ngwee),0) as written_off
      from public.loan_closures c
      join public.loans l on l.id = c.loan_id
     where c.deleted_at is null and c.loan_fully_paid = false and c.approved_at is not null
     group by 1
  )
  select jsonb_agg(jsonb_build_object(
           'period', to_char(pr.period_start, case when v_trunc='week' then 'YYYY-MM-DD' else 'YYYY-MM' end),
           'new_loans', coalesce(o.new_loans,0),
           'principal_disbursed', coalesce(o.principal_disbursed,0),
           'interest_booked', coalesce(o.interest_booked,0),
           'fees_booked', coalesce(o.fees_booked,0),
           'income_booked', coalesce(o.interest_booked,0) + coalesce(o.fees_booked,0),
           'cash_collected', coalesce(c.cash_collected,0),
           'written_off', coalesce(w.written_off,0)
         ) order by pr.period_start)
    into v_result
    from periods pr
    left join orig o on o.p = pr.period_start
    left join collected c on c.p = pr.period_start
    left join writeoffs w on w.p = pr.period_start;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke execute on function public.cfo_pnl(text, int) from public, anon;
grant  execute on function public.cfo_pnl(text, int) to authenticated, service_role;
