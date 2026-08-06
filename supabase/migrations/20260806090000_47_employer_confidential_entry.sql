-- ============================================================================
-- Migration 47 — Confidential employer entry (close the enumeration leak)
-- ============================================================================
--
-- PROBLEM. Migration 27's `employers_select_public_apply` granted SELECT on
-- every active employer to BOTH `anon` and `authenticated`:
--
--     for select to anon, authenticated using (status='active' and deleted_at is null)
--
-- so anyone — logged in or not — could enumerate the full list of companies
-- that have a Richmond MOU (a confidentiality breach for the employers), and
-- the public /apply/<slug> page even surfaced each employer's loan-pool
-- figures. The borrower apply wizard also listed every employer in a dropdown.
--
-- FIX (the "onthesquare" tenant model, adapted). Entry to an employer scheme
-- now requires a credential — either an HR-distributed invite TOKEN or the
-- employer's ACCESS CODE (printed on posters) — and there is no way to list
-- employers without one:
--   * the blanket public-apply policy is dropped; `anon` sees no employer rows
--     and an `authenticated` borrower sees only the ONE employer they're bound
--     to (existing `employers_select_staff_or_own`);
--   * two SECURITY DEFINER read RPCs return a single employer's public-safe
--     fields (NO pool internals) only when a valid code/token is presented;
--   * a redemption RPC binds the signed-in borrower to that one employer.
-- Enumeration is impossible because nothing returns a set, and a caller must
-- already hold the credential for the specific employer they ask about.
-- ============================================================================

-- ── 1. Schema ───────────────────────────────────────────────────────────────

-- Per-employer poster/HR access code (nullable ⇒ code entry disabled for that
-- employer; token-only). Not globally unique — it is only ever checked together
-- with the slug.
alter table public.employers
  add column if not exists access_code text,
  -- Minimal per-employer branding for the borrower portal (mirrors
  -- onthesquare's tenant_branding: just a colour + a logo path).
  add column if not exists brand_primary_color text,
  add column if not exists brand_logo_path text;

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

-- Richmond staff only mint/see/revoke invitations (business decision: employer
-- HR self-serve may come later — widening is a policy change, not a schema
-- change). Borrowers never select this table directly (redemption goes
-- through the RPC).
create policy employer_invitations_select_staff
  on public.employer_invitations for select to authenticated
  using (public.is_richmond_staff());

create policy employer_invitations_insert_staff
  on public.employer_invitations for insert to authenticated
  with check (public.is_richmond_staff());

create policy employer_invitations_update_staff
  on public.employer_invitations for update to authenticated
  using (public.is_richmond_staff())
  with check (public.is_richmond_staff());

-- ── 2. Close the enumeration hole ────────────────────────────────────────────
-- After this, anon has NO select policy on employers, and authenticated
-- borrowers fall through to employers_select_staff_or_own (their own employer
-- only). Staff are unaffected.
drop policy if exists employers_select_public_apply on public.employers;

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

-- Slug + access code (poster path). Returns the public fields only when the
-- code matches. `access_code is not null` guards employers that opted out of
-- the code path. Case-insensitive slug (citext); code compared exactly.
create or replace function public.employer_apply_info_by_code(p_slug citext, p_code text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select public.employer_public_fields(e)
    from public.employers e
   where e.slug = p_slug
     and e.deleted_at is null
     and e.status = 'active'
     and e.access_code is not null
     and e.access_code = p_code
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
  p_slug  citext default null,
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
  elsif p_slug is not null and p_code is not null then
    select e.id into v_employer
      from public.employers e
     where e.slug = p_slug
       and e.deleted_at is null
       and e.status = 'active'
       and e.access_code is not null
       and e.access_code = p_code
     limit 1;
  else
    raise exception 'provide an invite token or a slug and access code' using errcode = '22023';
  end if;

  if v_employer is null then
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
revoke all on function public.employer_apply_info_by_code(citext, text) from public;
revoke all on function public.employer_apply_info_by_invite(text) from public;
grant execute on function public.employer_apply_info_by_code(citext, text) to anon, authenticated, service_role;
grant execute on function public.employer_apply_info_by_invite(text) to anon, authenticated, service_role;

-- Redemption mutates the caller's profile: authenticated only, never anon.
revoke all on function public.redeem_employer_entry(text, citext, text) from public, anon;
grant execute on function public.redeem_employer_entry(text, citext, text) to authenticated, service_role;
