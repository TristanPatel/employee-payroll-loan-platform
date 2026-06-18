-- Phase 6 / 41 — Per-employer DD checklist overrides.
--
-- The seed_due_diligence() function plants a fixed 12-item checklist on every
-- application. The MOUs we have on file each define employer-specific
-- eligibility rules that the standard checklist does not cover:
--
--   Choppies (MOU §1.0): borrower must have ≥3 consecutive months of service,
--                        must not be on probation, must not be on
--                        disciplinary suspension at time of application.
--   Choppies (MOU §4.8): top-up / refinance requires authorised Union
--                        representative + authorised Company Management
--                        representative approvals before Richmond decides.
--   C4C (MOU §4.7) + Seba Foods / 260 Brands (MOU §4.8): same top-up consent
--                                                        chain + fortnight-
--                                                        contract rule.
--
-- This migration:
--   1. Adds public.employer_dd_overrides — one row per (employer, item_key).
--      Each row produces an additional due_diligence_checks row on seed.
--   2. Extends seed_due_diligence() to merge the employer's overrides into
--      the fresh checklist. Backwards-compatible: applications under
--      employers with zero overrides see the same 12 items as before.
--   3. Seeds the variances we have MOUs for. Sino Metals and Government of
--      Zambia stay on the standard 12 until we have readable MOUs (Sino's
--      uploaded copy is a scanned image; GRZ's was not shared).

create table public.employer_dd_overrides (
  id              uuid primary key default gen_random_uuid(),
  employer_id     uuid not null references public.employers(id) on delete cascade,
  phase           smallint not null check (phase between 1 and 9),
  item_no         smallint not null check (item_no between 1 and 99),
  item_key        text not null,
  description     text not null,
  severity        text not null check (severity in ('critical','major','minor')),
  applies_to      public.loan_application_type[] not null
                  default array['new_loan','refinancing']::public.loan_application_type[],
  source_clause   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (employer_id, item_key)
);

create trigger trg_employer_dd_overrides_touch
  before update on public.employer_dd_overrides
  for each row execute function public.touch_updated_at();

alter table public.employer_dd_overrides enable row level security;

-- Read: Richmond staff (everyone with a staff-side dashboard). Employers can
-- see their own overrides so an employer-admin's UI can show "these are the
-- extra checks Richmond performs for our scheme".
create policy employer_dd_overrides_select_staff on public.employer_dd_overrides
  for select to authenticated using ( public.is_richmond_staff() );

create policy employer_dd_overrides_select_own on public.employer_dd_overrides
  for select to authenticated using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );

-- Write: master_admin only. Editing the checklist for an employer changes
-- credit risk shape, so it sits with the same control as employer pool sizing.
create policy employer_dd_overrides_write_master on public.employer_dd_overrides
  for all to authenticated
  using       ( public.is_master_admin() )
  with check  ( public.is_master_admin() );

create index employer_dd_overrides_employer_idx
  on public.employer_dd_overrides (employer_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- seed_due_diligence() — extend to merge employer overrides into the seed.
-- Same SECURITY DEFINER + search_path as before; same idempotence guard.
-- ---------------------------------------------------------------------------

create or replace function public.seed_due_diligence(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_items text[][] := array[
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
  v_app public.loan_applications%rowtype;
begin
  -- Idempotent: skip if any checks already exist for this application.
  if exists (
    select 1 from public.due_diligence_checks
     where application_id = p_application_id
  ) then
    return;
  end if;

  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then
    raise exception 'application % not found', p_application_id using errcode='P0002';
  end if;

  -- 1. The standard 12 items every application gets.
  foreach rec slice 1 in array v_items loop
    insert into public.due_diligence_checks
      (application_id, phase, item_no, item_key, state, severity)
    values
      (p_application_id, rec[1]::smallint, rec[2]::smallint, rec[3], 'pending', rec[4]);
  end loop;

  -- 2. The employer-specific items, if any. Filtered by the application's
  --    type so a refinancing-only check (e.g. top-up consent) doesn't appear
  --    on a brand-new loan.
  insert into public.due_diligence_checks
    (application_id, phase, item_no, item_key, state, severity)
  select
    p_application_id, o.phase, o.item_no, o.item_key, 'pending', o.severity
  from public.employer_dd_overrides o
  where o.employer_id = v_app.employer_id
    and o.deleted_at is null
    and v_app.application_type = any (o.applies_to);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Seed the overrides we have MOUs for.
-- ---------------------------------------------------------------------------

-- Choppies Supermarkets Zambia Limited — MOU §1.0 (eligibility) + §4.8 (top-up consent).
insert into public.employer_dd_overrides
  (employer_id, phase, item_no, item_key, description, severity, applies_to, source_clause)
values
  ('7f975f0b-27ff-4bcc-8a86-2a4be573b676',
   1, 11, 'choppies_min_tenure_3_months',
   'Borrower has at least 3 consecutive months of employment under a valid contract.',
   'critical',
   array['new_loan','refinancing']::public.loan_application_type[],
   'Choppies MOU §1.0 (Employee definition)'),

  ('7f975f0b-27ff-4bcc-8a86-2a4be573b676',
   1, 12, 'choppies_not_on_probation',
   'Borrower is not on probation at time of application.',
   'critical',
   array['new_loan','refinancing']::public.loan_application_type[],
   'Choppies MOU §1.0'),

  ('7f975f0b-27ff-4bcc-8a86-2a4be573b676',
   1, 13, 'choppies_not_disciplinary_suspended',
   'Borrower is not serving a disciplinary suspension at time of application.',
   'critical',
   array['new_loan','refinancing']::public.loan_application_type[],
   'Choppies MOU §1.0'),

  ('7f975f0b-27ff-4bcc-8a86-2a4be573b676',
   3, 11, 'choppies_topup_union_and_management_consent',
   'Top-up / refinance has written consent from authorised Union representative and authorised Choppies Management representative.',
   'critical',
   array['refinancing']::public.loan_application_type[],
   'Choppies MOU §4.8');

-- Seba Foods 260 Brands Limited — MOU §4.8 (top-up consent) + fortnight rule.
insert into public.employer_dd_overrides
  (employer_id, phase, item_no, item_key, description, severity, applies_to, source_clause)
values
  ('81730d46-cbee-43ae-b4ed-b50816bc8dd7',
   3, 11, 'seba_topup_union_and_management_consent',
   'Top-up / refinance has written consent from authorised Union representative and authorised 260 Brands Management representative.',
   'critical',
   array['refinancing']::public.loan_application_type[],
   '260 Brands MOU §4.8'),

  ('81730d46-cbee-43ae-b4ed-b50816bc8dd7',
   1, 14, 'seba_fortnight_contract_rule',
   'If the borrower is on a fortnight contract, the loan term does not exceed the contract length, and only salary-advance products are eligible.',
   'critical',
   array['new_loan','refinancing']::public.loan_application_type[],
   '260 Brands MOU §4.8 (Fortnight Contracts)');

-- Sino Metals Leach Zambia Limited: MOU PDF on file is a scanned image; readable
-- text not yet available. Standard 12-item checklist stands until we receive a
-- text-extractable copy and add the equivalent overrides.

-- Government of the Republic of Zambia: no MOU shared. Same standard.
