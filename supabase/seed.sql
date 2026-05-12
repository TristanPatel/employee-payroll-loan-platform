-- Employee Payroll Loan Portal — local dev / remote bootstrap seed.
-- Idempotent: re-running this file is safe. Demo user accounts are created
-- separately via Supabase Auth (see docs/dev/seed-auth.md) and then linked
-- into profiles by NRC; this seed only owns master data.

-- ─── Tax settings (2025/2026 PAYE bands)

insert into public.tax_settings (
  effective_from, paye_bands, napsa_rate, napsa_ceiling_ngwee,
  nhima_rate, nhima_basis, notes
) values (
  date '2025-01-01',
  jsonb_build_array(
    jsonb_build_object('upTo', 4500, 'marginalRate', 0),
    jsonb_build_object('upTo', 4800, 'marginalRate', 0.25),
    jsonb_build_object('upTo', 6900, 'marginalRate', 0.30),
    jsonb_build_object('upTo', null, 'marginalRate', 0.375)
  ),
  0.0500,
  154020,   -- K1,540.20 ceiling
  0.0100,
  'basic',
  'Seeded from Choppies/Sino loan generator workbook v2.3 (2025/2026 tax year).'
)
on conflict (effective_from) where deleted_at is null do nothing;

-- ─── Branches (LS Lusaka HQ, KT Kitwe, ND Ndola)

insert into public.branches (branch_code, name, town, province, legacy_code) values
  ('LS', 'Lusaka HQ', 'Lusaka', 'Lusaka', '1000'),
  ('KT', 'Kitwe',    'Kitwe',  'Copperbelt', '4624'),
  ('ND', 'Ndola',    'Ndola',  'Copperbelt', '2200')
on conflict (branch_code) do nothing;

-- ─── Employers (confirmed list 2026-05-12)

insert into public.employers (
  legal_name, trading_name, registration_no,
  monthly_interest_rate, admin_fee_pct, insurance_fee_pct,
  max_debt_ratio_pct, max_tenure_months,
  total_loan_pool_ngwee, used_pool_ngwee,
  payroll_run_day, deduction_cutoff_day, repayment_remittance_day,
  contact_address, contact_email
) values
  ('Sino Metals Leach Zambia Limited', 'Sino Metals', null,
   0.0400, 0.0200, 0.0200, 0.3000, 12,
   500000000, 0, 25, 25, 7,
   'Chambishi, Copperbelt, Zambia', null),
  ('Seba Foods 260 Brands Limited', 'Seba Foods 260 Brands', null,
   0.0400, 0.0200, 0.0200, 0.3000, 12,
   300000000, 0, 25, 25, 7,
   'Lusaka, Zambia', null),
  ('Government of the Republic of Zambia', 'GRZ', null,
   0.0400, 0.0200, 0.0200, 0.3000, 12,
   2000000000, 0, 25, 25, 7,
   'Cabinet Office, Lusaka, Zambia', null),
  ('Choppies Supermarkets Zambia Limited', 'Choppies', null,
   0.0400, 0.0200, 0.0200, 0.3500, 12,
   400000000, 0, 25, 25, 7,
   'Lusaka, Zambia', null)
on conflict (legal_name) do nothing;

-- ─── Per-employer benefits scaffolds (so admin UI can edit later)
insert into public.employer_benefits (employer_id)
select e.id from public.employers e
where not exists (select 1 from public.employer_benefits b where b.employer_id = e.id);

-- ─── Per-employer payroll config scaffolds
insert into public.employer_payroll_config (employer_id, payroll_run_day)
select e.id, e.payroll_run_day from public.employers e
where not exists (select 1 from public.employer_payroll_config c where c.employer_id = e.id);

-- ─── Storage buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('application-docs',  'application-docs',  false),
  ('employer-docs',     'employer-docs',     false),
  ('contracts',         'contracts',         false),
  ('signatures',        'signatures',        false),
  ('pop',               'pop',               false)
on conflict (id) do nothing;
