-- Phase 1 / 05 — Employer partners.
-- Employers sign an MOU with Richmond, agree to payroll deduction, and remit
-- monthly. Per-employer config holds the lending economics (rate, fees, debt
-- ratio cap) so master_admin can tune each partnership independently.

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  registration_no text,
  tpin text,

  mou_ref text,
  mou_signed_date date,
  mou_storage_path text,

  -- Lending economics (set at onboarding, editable thereafter)
  monthly_interest_rate numeric(6,4) not null default 0.0400, -- 4% per month
  admin_fee_pct numeric(6,4) not null default 0.0200,
  insurance_fee_pct numeric(6,4) not null default 0.0200,
  max_debt_ratio_pct numeric(6,4) not null default 0.3000,
  max_tenure_months smallint not null default 12,
  salary_advance_enabled boolean not null default true,
  salary_advance_max_months smallint not null default 3,

  -- Loan pool (in ngwee, integer)
  total_loan_pool_ngwee bigint not null default 0,
  used_pool_ngwee bigint not null default 0,

  -- Payroll cycle
  payroll_run_day smallint not null default 25,        -- day employer cuts payroll
  deduction_cutoff_day smallint not null default 25,   -- last day to register a new deduction
  repayment_remittance_day smallint not null default 7,-- day remittance reaches Richmond
  settlement_quote_validity_days smallint not null default 30,

  -- Contact
  contact_address text,
  contact_phone text,
  contact_email citext,

  status public.entity_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint employers_legal_name_unique unique (legal_name),
  constraint employers_payroll_run_day_range check (payroll_run_day between 1 and 28),
  constraint employers_deduction_cutoff_day_range check (deduction_cutoff_day between 1 and 28),
  constraint employers_repayment_remittance_day_range check (repayment_remittance_day between 1 and 28),
  constraint employers_rates_nonneg check (
    monthly_interest_rate >= 0 and admin_fee_pct >= 0 and insurance_fee_pct >= 0
    and max_debt_ratio_pct between 0 and 1
  ),
  constraint employers_pool_nonneg check (total_loan_pool_ngwee >= 0 and used_pool_ngwee >= 0),
  constraint employers_max_tenure_pos check (max_tenure_months > 0)
);

create index employers_status_idx on public.employers (status) where deleted_at is null;

create trigger trg_employers_touch before update on public.employers
for each row execute function public.touch_updated_at();

comment on table public.employers is 'Employer partners with payroll-deduction MOU agreements.';
comment on column public.employers.monthly_interest_rate is 'Straight-line monthly rate set per employer (e.g. 0.0400 = 4%).';
comment on column public.employers.total_loan_pool_ngwee is 'Aggregate loan pool ceiling in ngwee (1 K = 100 ngwee).';

create table public.employer_signatories (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete restrict,
  full_name text not null,
  position text not null,
  email citext,
  phone text,
  specimen_signature_storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create index employer_signatories_employer_idx
  on public.employer_signatories (employer_id) where deleted_at is null;

create trigger trg_employer_signatories_touch before update on public.employer_signatories
for each row execute function public.touch_updated_at();

comment on table public.employer_signatories is
  'Named HR/Finance signatories per employer. Specimen signature is used by CSE for side-by-side verification during due diligence.';

create table public.employer_payroll_config (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null unique references public.employers (id) on delete restrict,
  payroll_run_day smallint,
  payment_schedule_date text,
  submission_format text,
  payout_format text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create trigger trg_employer_payroll_config_touch before update on public.employer_payroll_config
for each row execute function public.touch_updated_at();

create table public.employer_benefits (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null unique references public.employers (id) on delete restrict,
  life_cover boolean not null default false,
  disability_cover boolean not null default false,
  funeral_plan boolean not null default false,
  retrenchment_benefits boolean not null default false,
  other_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create trigger trg_employer_benefits_touch before update on public.employer_benefits
for each row execute function public.touch_updated_at();

create table public.employer_documents (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete restrict,
  doc_type public.document_type not null,
  storage_path text not null,
  uploaded_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index employer_documents_employer_idx
  on public.employer_documents (employer_id) where deleted_at is null;

create trigger trg_employer_documents_touch before update on public.employer_documents
for each row execute function public.touch_updated_at();
