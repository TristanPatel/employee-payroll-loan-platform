-- Fixes uncovered by end-to-end RPC test on 2026-06-05:
--
-- 1. audit_row_changes() used `new::jsonb` / `old::jsonb` which Postgres
--    doesn't support as a direct cast from table row types. Every audited
--    INSERT/UPDATE (loan_applications, contracts, etc.) fails with
--    "cannot cast type <table> to jsonb". Switch to to_jsonb().
--
-- 2. due_diligence_checks check-constraints from migration 09 declared
--    severity in ('info','warn','block') and state in ('pending','passed','failed'),
--    but seed_due_diligence (migration 21) writes severity values
--    critical/major/minor and the admin UI writes state values
--    pending/pass/fail/na. Widen the constraints to match what the
--    application code uses end-to-end.
--
-- 3. due_diligence_checks_unique_item was UNIQUE (application_id, item_no),
--    but seed_due_diligence reuses item_no across phases (phase 1 has
--    items 1..5, phase 2 has items 1..4, etc.), so the second phase's
--    item 1 collides. Include phase in the unique key.

create or replace function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    perform public.write_audit(
      tg_op, tg_table_name,
      coalesce((v_new ->> 'id')::uuid, null),
      null, v_new
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    perform public.write_audit(
      tg_op, tg_table_name,
      coalesce((v_new ->> 'id')::uuid, null),
      v_old, v_new
    );
    return new;
  end if;
  return null;
end;
$function$;

alter table public.due_diligence_checks
  drop constraint if exists due_diligence_checks_severity_valid;
alter table public.due_diligence_checks
  add constraint due_diligence_checks_severity_valid
  check (severity in ('critical','major','minor'));

alter table public.due_diligence_checks
  drop constraint if exists due_diligence_checks_state_valid;
alter table public.due_diligence_checks
  add constraint due_diligence_checks_state_valid
  check (state in ('pending','pass','fail','na'));

alter table public.due_diligence_checks
  alter column severity set default 'minor';

alter table public.due_diligence_checks
  drop constraint if exists due_diligence_checks_unique_item;
alter table public.due_diligence_checks
  add constraint due_diligence_checks_unique_item
  unique (application_id, phase, item_no);
