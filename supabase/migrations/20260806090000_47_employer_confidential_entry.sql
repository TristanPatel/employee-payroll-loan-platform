-- ============================================================================
-- Migration 47 — Confidential employer entry (ADDITIVE / expand phase)
-- ============================================================================
--
-- PROBLEM. Migration 27's `employers_select_public_apply` grants SELECT on every
-- active employer to BOTH `anon` and `authenticated`, so anyone can enumerate
-- the companies that hold a Richmond MOU. The fix requires a per-employer
-- credential (HR invite token or poster access code) to reach a scheme.
--
-- EXPAND/CONTRACT. This migration is the ADDITIVE half and is safe to apply
-- while the OLD app is still live: it only adds columns, a table, and RPCs, and
-- it BACKFILLS an access code for every active employer. It does NOT drop the
-- public-enumeration policy — the old app keeps working. The policy drop lives
-- in migration 48 (the contract half), applied only AFTER the new app is
-- deployed and codes exist. Ordering:
--   1. apply THIS (47) — old app unaffected, codes minted
--   2. deploy the new app (its RPCs now exist)
--   3. smoke-test a real code + invite on the live new app
--   4. apply migration 48 — the leak closes with the new flow already serving
-- Rollback for 48 is a one-line `create policy` (see that file).
-- ============================================================================

-- ── 1. Schema ───────────────────────────────────────────────────────────────

-- Poster/HR access code (nullable ⇒ code entry disabled for that employer;
-- token-only). Globally unique so a borrower can enter it anywhere — "enter
-- your access code" — without needing the company in the URL. Codes come from
-- the unambiguous Crockford-ish alphabet, so uniqueness across a handful of
-- employers is trivially satisfiable.
alter table public.employers
  add column if not exists access_code text,
  -- Minimal per-employer branding for the borrower portal (mirrors
  -- onthesquare's tenant_branding: just a colour + a logo path).
  add column if not exists brand_primary_color text,
  add column if not exists brand_logo_path text;

create unique index if not exists employers_access_code_unique
  on public.employers (upper(access_code))
  where access_code is not null and deleted_at is null;

-- HR-distributed tokenized invitations. A token deep-links to /join/<token>,
-- which (after sign-in) binds the borrower to the employer. Optional hints let
-- HR pre-scope an invite to one employee without exposing anything.
create table if not exists public.employer_invitations (
  id           uuid primary key default gen_random_uuid(),
  employer_id  uuid not null references public.employers (id) on delete cascade,
  token        text not null unique,
  employee_no_hint text,
  phone_hint   text,
  note         text,
  created_by   uuid references public.profiles (id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '30 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists employer_invitations_employer_idx
  on public.employer_invitations (employer_id) where revoked_at is null;

alter table public.employer_invitations enable row level security;

-- Non-auditor Richmond staff mint/see/revoke invitations. `auditor` is a
-- read-only role and must NOT be able to create working invite links (which let
-- an arbitrary person join a scheme), so the write policies exclude it; the
-- read policy includes it. (Employer HR self-serve may come later — widening is
-- a policy change, not a schema change.) Borrowers never select this table
-- directly; redemption goes through the RPC.
create policy employer_invitations_select_staff
  on public.employer_invitations for select to authenticated
  using (public.is_richmond_staff());

create policy employer_invitations_insert_staff
  on public.employer_invitations for insert to authenticated
  with check (public.has_role(array['master_admin','branch_manager','cse',
                                    'approver_l1','approver_l2','accounts']::public.user_role[]));

create policy employer_invitations_update_staff
  on public.employer_invitations for update to authenticated
  using (public.has_role(array['master_admin','branch_manager','cse',
                               'approver_l1','approver_l2','accounts']::public.user_role[]))
  with check (public.has_role(array['master_admin','branch_manager','cse',
                                    'approver_l1','approver_l2','accounts']::public.user_role[]));

-- ── 3. Public-safe projection ────────────────────────────────────────────────
-- The exact set of fields the apply landing / calculator needs. Deliberately
-- EXCLUDES total_loan_pool_ngwee / used_pool_ngwee and any counterparty data.
create or replace function public.employer_public_fields(e public.employers)
returns jsonb
language sql immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'legal_name', e.legal_name,
    'trading_name', e.trading_name,
    'slug', e.slug,
    'monthly_interest_rate', e.monthly_interest_rate,
    'admin_fee_pct', e.admin_fee_pct,
    'insurance_fee_pct', e.insurance_fee_pct,
    'max_debt_ratio_pct', e.max_debt_ratio_pct,
    'max_tenure_months', e.max_tenure_months,
    'salary_advance_enabled', e.salary_advance_enabled,
    'salary_advance_max_months', e.salary_advance_max_months,
    'brand_primary_color', e.brand_primary_color,
    'brand_logo_path', e.brand_logo_path
  );
$$;

-- ── 4. Credentialled read RPCs (single employer, no enumeration) ─────────────

-- Access code (poster path). Globally unique, case-insensitive. Returns the
-- public fields only when the code matches an active employer.
create or replace function public.employer_apply_info_by_code(p_code text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select public.employer_public_fields(e)
    from public.employers e
   where e.deleted_at is null
     and e.status = 'active'
     and e.access_code is not null
     and upper(e.access_code) = upper(p_code)
   limit 1;
$$;

-- Invite token (HR path). Valid = exists, not expired, not revoked.
create or replace function public.employer_apply_info_by_invite(p_token text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select public.employer_public_fields(e)
    from public.employer_invitations i
    join public.employers e on e.id = i.employer_id
   where i.token = p_token
     and i.revoked_at is null
     and i.expires_at > now()
     and e.deleted_at is null
     and e.status = 'active'
   limit 1;
$$;

-- ── 5. Redemption — bind the signed-in borrower to ONE employer ──────────────
-- Validates a token OR slug+code, then pins profiles.employer_id so RLS lets
-- the borrower see their employer in the wizard. Does not touch the employees
-- row (the wizard's Employment step still collects employee_no/salary). A
-- borrower already bound to a DIFFERENT employer is rejected — single scheme
-- per borrower.
create or replace function public.redeem_employer_entry(
  p_token text default null,
  p_code  text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     user_role;
  v_current  uuid;
  v_employer uuid;
  v_invite   uuid;
begin
  if v_uid is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select role, employer_id into v_role, v_current
    from public.profiles where id = v_uid and deleted_at is null;
  if v_role is distinct from 'employee' then
    raise exception 'only borrowers can join an employer scheme' using errcode = '42501';
  end if;

  if p_token is not null then
    select i.id, i.employer_id into v_invite, v_employer
      from public.employer_invitations i
      join public.employers e on e.id = i.employer_id
     where i.token = p_token
       and i.revoked_at is null
       and i.expires_at > now()
       and e.deleted_at is null
       and e.status = 'active'
     limit 1;
  elsif p_code is not null then
    select e.id into v_employer
      from public.employers e
     where e.deleted_at is null
       and e.status = 'active'
       and e.access_code is not null
       and upper(e.access_code) = upper(p_code)
     limit 1;
  else
    raise exception 'provide an invite token or an access code' using errcode = '22023';
  end if;

  if v_employer is null then
    -- Observability for brute-force / bad links: log the failed attempt (no
    -- employer id, since none resolved) before rejecting.
    perform public.log_event('employer.entry_failed', null, 'employer',
      jsonb_build_object('via', case when p_token is not null then 'token' else 'code' end));
    raise exception 'that link or access code is not valid' using errcode = '22023';
  end if;

  if v_current is not null and v_current <> v_employer then
    raise exception 'this account is already linked to a different employer' using errcode = '42501';
  end if;

  update public.profiles set employer_id = v_employer, updated_at = now()
   where id = v_uid;

  if v_invite is not null then
    update public.employer_invitations
       set accepted_at = coalesce(accepted_at, now()), accepted_by = v_uid
     where id = v_invite;
  end if;

  perform public.log_event('employer.entry_redeem', v_employer, 'employer',
    jsonb_build_object('via', case when p_token is not null then 'token' else 'code' end));

  return v_employer;
end;
$$;

-- ── 6. Grants ────────────────────────────────────────────────────────────────
-- Read RPCs: callable pre-sign-in (anon) and after (authenticated). They leak
-- nothing without a valid credential.
revoke all on function public.employer_apply_info_by_code(text) from public;
revoke all on function public.employer_apply_info_by_invite(text) from public;
grant execute on function public.employer_apply_info_by_code(text) to anon, authenticated, service_role;
grant execute on function public.employer_apply_info_by_invite(text) to anon, authenticated, service_role;

-- Redemption mutates the caller's profile: authenticated only, never anon.
revoke all on function public.redeem_employer_entry(text, text) from public, anon;
grant execute on function public.redeem_employer_entry(text, text) to authenticated, service_role;

-- ── 7. Backfill an access code for every active employer ─────────────────────
-- So the code path works the instant the new app deploys — no employer is left
-- with "no way in" between this migration and staff manually minting codes.
-- 10 chars from the unambiguous alphabet (~50 bits) makes the anon code lookup
-- infeasible to brute-force. Matches the app generator (lib/employer-entry.ts).
do $$
declare
  r      record;
  v_code text;
  v_alpha text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  i      int;
begin
  for r in
    select id from public.employers
     where status = 'active' and deleted_at is null and access_code is null
  loop
    loop
      v_code := '';
      for i in 1..10 loop
        v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1);
      end loop;
      begin
        update public.employers set access_code = v_code where id = r.id;
        exit;  -- unique code assigned
      exception when unique_violation then
        -- astronomically unlikely at 10 chars; loop and try another
      end;
    end loop;
  end loop;
end $$;
