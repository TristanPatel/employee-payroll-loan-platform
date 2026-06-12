-- ============================================================================
-- Migration 33 — realtime admin cockpit + automated workflow rules
-- ============================================================================

-- 1) Realtime: publish row changes for the tables the admin cockpit watches.
--    RLS still applies to realtime subscribers, so staff see staff-visible
--    rows and borrowers see their own.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    raise notice 'supabase_realtime publication missing; skipping';
    return;
  end if;
  foreach t in array array[
    'loan_applications','contracts','loans','notifications',
    'employer_attestations','due_diligence_checks'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;

-- Realtime delivers old/new row images based on replica identity; FULL gives
-- subscribers the previous values on UPDATE (needed for status-change toasts).
alter table public.loan_applications replica identity full;
alter table public.contracts replica identity full;
alter table public.loans replica identity full;
alter table public.employer_attestations replica identity full;

-- 2) Workflow rules: one idempotent function, run hourly by pg_cron.
create or replace function public.run_workflow_rules()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reminders int := 0;
  v_escalations int := 0;
  v_arrears int := 0;
  r record;
  s record;
begin
  -- Rule A: employer attestation pending > 48h → remind signatories (max
  -- one reminder per 48h, tracked via reminded_at).
  for r in
    select a.id, a.application_id, a.application_no_snapshot, a.employer_id
      from public.employer_attestations a
     where a.status = 'pending'
       and a.requested_at < now() - interval '48 hours'
       and (a.reminded_at is null or a.reminded_at < now() - interval '48 hours')
  loop
    for s in
      select id from public.profiles
       where role in ('employer_admin','employer_signatory')
         and employer_id = r.employer_id and is_active and deleted_at is null
    loop
      perform public.notify(s.id, 'employer_attestation_reminder',
        jsonb_build_object('application_id', r.application_id,
                           'application_no', r.application_no_snapshot));
    end loop;
    update public.employer_attestations set reminded_at = now() where id = r.id;
    v_reminders := v_reminders + 1;
  end loop;

  -- Rule B: application sitting in cse_review > 5 days → escalate to the
  -- branch manager + master admin (once per 24h, deduped via notifications).
  for r in
    select la.id, la.application_no
      from public.loan_applications la
     where la.status = 'cse_review'
       and la.started_cse_review_at < now() - interval '5 days'
       and not exists (
         select 1 from public.notifications n
          where n.template = 'cse_review_stale'
            and n.payload->>'application_id' = la.id::text
            and n.created_at > now() - interval '24 hours'
       )
  loop
    for s in
      select id from public.profiles
       where role in ('branch_manager','master_admin') and is_active and deleted_at is null
    loop
      perform public.notify(s.id, 'cse_review_stale',
        jsonb_build_object('application_id', r.id, 'application_no', r.application_no),
        array['in_app','email']::notification_channel[]);
    end loop;
    v_escalations := v_escalations + 1;
  end loop;

  -- Rule C: refresh arrears flags from overdue schedule lines.
  v_arrears := public.recompute_arrears();

  return jsonb_build_object(
    'attestation_reminders', v_reminders,
    'cse_review_escalations', v_escalations,
    'loans_marked_in_arrears', v_arrears,
    'ran_at', now()
  );
end;
$$;

revoke execute on function public.run_workflow_rules() from public;
revoke execute on function public.run_workflow_rules() from anon;
revoke execute on function public.run_workflow_rules() from authenticated;
grant execute on function public.run_workflow_rules() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    raise notice 'pg_cron not available; skipping workflow rules schedule';
    return;
  end if;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname='workflow_rules_hourly';
  perform cron.schedule('workflow_rules_hourly', '15 * * * *',
                        'select public.run_workflow_rules();');
end$$;
