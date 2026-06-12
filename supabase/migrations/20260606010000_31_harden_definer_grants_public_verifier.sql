-- 1) Tighten EXECUTE on every SECURITY DEFINER function in public.
--    Supabase grants EXECUTE to PUBLIC by default, so anon could invoke all
--    22 RPCs + trigger functions (advisor: *_security_definer_function_executable).
--    They all no-op or raise for anon (auth.uid() is null) but there is no
--    reason to leave them callable. Exceptions:
--      • is_richmond_staff / has_role stay anon-executable — they are
--        referenced by RLS policies that anon evaluates
--        (remittance_batches_select_staff, storage remittances_read_staff).
--      • trigger functions lose authenticated EXECUTE too — they are only
--        ever fired by triggers, which do not check caller EXECUTE.
do $$
declare
  r record;
  trigger_fns constant text[] := array[
    'handle_new_user','audit_row_changes','advance_contract_status_on_signature',
    'app_advance_on_contract_sign','app_create_loan_on_approval'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    if r.proname in ('is_richmond_staff','has_role') then
      continue;
    end if;
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    if r.proname = any(trigger_fns) then
      execute format('revoke execute on function %s from authenticated', r.sig);
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end$$;

-- 2) Public contract verifier. /verify/[contractId] runs with the anon key
--    but contracts/contract_signatures policies are all `to authenticated`,
--    so the public page could never show a real certificate. A direct anon
--    SELECT policy would over-expose (signatures carry NRC, IP, geolocation),
--    so expose exactly the verifier's fields through one definer RPC.
create or replace function public.verify_contract(p_contract_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', c.id,
    'contract_type', c.contract_type,
    'status', c.status,
    'document_sha256', c.document_sha256,
    'fully_signed_pdf_sha256', c.fully_signed_pdf_sha256,
    'fully_signed_at', c.fully_signed_at,
    'voided_at', c.voided_at,
    'required_signatories', c.required_signatories,
    'created_at', c.created_at,
    'signatures', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'signatory_role', s.signatory_role,
          'signatory_name_snapshot', s.signatory_name_snapshot,
          'signed_at', s.signed_at,
          'envelope_sha256', s.envelope_sha256
        ) order by s.signed_at),
        '[]'::jsonb)
      from public.contract_signatures s
      where s.contract_id = c.id
    )
  )
  from public.contracts c
  where c.id = p_contract_id;
$$;

revoke execute on function public.verify_contract(uuid) from public;
grant execute on function public.verify_contract(uuid) to anon, authenticated, service_role;
