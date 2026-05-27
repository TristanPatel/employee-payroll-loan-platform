-- Phase 1 / 10 — Loans, repayment schedule, repayments, remittance batches.
-- Money: all ngwee (bigint).

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.loan_applications (id) on delete restrict,
  loan_no text unique,
  legacy_loan_no text, -- old paper-file number, e.g. RFL4624693755

  employee_id uuid not null references public.employees (id) on delete restrict,
  employer_id uuid not null references public.employers (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,

  product public.loan_product not null,
  principal_ngwee bigint not null,
  monthly_interest_rate numeric(6,4) not null,
  tenure_months smallint not null,

  admin_fee_ngwee bigint not null,
  insurance_fee_ngwee bigint not null,
  total_interest_ngwee bigint not null,
  total_collectable_ngwee bigint not null,
  monthly_installment_ngwee bigint not null,
  disbursed_amount_ngwee bigint not null,
  current_outstanding_ngwee bigint not null default 0,

  start_date date not null,
  end_date date not null,

  status public.loan_status not null default 'pending_disbursement',
  disbursement_method text,
  disbursement_ref text,
  disbursed_at timestamptz,
  disbursed_by uuid references public.profiles (id) on delete set null,
  disbursement_authorised_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint loans_amounts_nonneg check (
    principal_ngwee >= 0
    and admin_fee_ngwee >= 0 and insurance_fee_ngwee >= 0
    and total_interest_ngwee >= 0 and total_collectable_ngwee >= 0
    and monthly_installment_ngwee >= 0 and disbursed_amount_ngwee >= 0
    and current_outstanding_ngwee >= 0
  ),
  constraint loans_tenure_pos check (tenure_months > 0),
  constraint loans_dates_ordered check (end_date >= start_date)
);

create index loans_status_idx on public.loans (status) where deleted_at is null;
create index loans_employee_idx on public.loans (employee_id) where deleted_at is null;
create index loans_employer_idx on public.loans (employer_id) where deleted_at is null;
create index loans_branch_idx on public.loans (branch_id) where deleted_at is null;

create trigger trg_loans_touch before update on public.loans
for each row execute function public.touch_updated_at();

create table public.loan_schedule (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete restrict,
  instalment_no smallint not null,
  due_date date not null,
  scheduled_amount_ngwee bigint not null,
  principal_component_ngwee bigint not null,
  interest_component_ngwee bigint not null,
  status public.schedule_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint loan_schedule_instalment_pos check (instalment_no > 0),
  constraint loan_schedule_amounts_nonneg check (
    scheduled_amount_ngwee >= 0
    and principal_component_ngwee >= 0
    and interest_component_ngwee >= 0
  ),
  constraint loan_schedule_unique_per_loan unique (loan_id, instalment_no)
);

create index loan_schedule_loan_idx on public.loan_schedule (loan_id) where deleted_at is null;
create index loan_schedule_due_date_idx on public.loan_schedule (due_date) where deleted_at is null;

create trigger trg_loan_schedule_touch before update on public.loan_schedule
for each row execute function public.touch_updated_at();

create table public.remittance_batches (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete restrict,
  period_month smallint not null,
  period_year smallint not null,
  total_amount_ngwee bigint not null default 0,
  employee_count integer not null default 0,
  status public.remittance_status not null default 'draft',
  schedule_pdf_path text,
  remittance_pdf_path text,
  sent_at timestamptz,
  received_at timestamptz,
  reconciled_at timestamptz,
  reconciled_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint remittance_batches_period_month_range check (period_month between 1 and 12),
  constraint remittance_batches_period_year_range check (period_year between 2020 and 2100),
  constraint remittance_batches_unique_period unique (employer_id, period_year, period_month)
);

create index remittance_batches_employer_idx on public.remittance_batches (employer_id) where deleted_at is null;
create index remittance_batches_status_idx on public.remittance_batches (status) where deleted_at is null;

create trigger trg_remittance_batches_touch before update on public.remittance_batches
for each row execute function public.touch_updated_at();

create table public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete restrict,
  schedule_id uuid references public.loan_schedule (id) on delete set null,
  employer_id uuid not null references public.employers (id) on delete restrict,
  amount_ngwee bigint not null,
  payment_date date not null,
  deduction_period_month smallint,
  deduction_period_year smallint,
  bank_reference text,
  remittance_batch_id uuid references public.remittance_batches (id) on delete set null,
  captured_by uuid references public.profiles (id) on delete set null,
  evidence_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint repayments_amount_pos check (amount_ngwee > 0)
);

create index repayments_loan_idx on public.repayments (loan_id) where deleted_at is null;
create index repayments_employer_idx on public.repayments (employer_id) where deleted_at is null;
create index repayments_batch_idx on public.repayments (remittance_batch_id) where deleted_at is null;

create trigger trg_repayments_touch before update on public.repayments
for each row execute function public.touch_updated_at();

comment on table public.loans is 'Disbursed loans. Outstanding balance updated as repayments come in.';
comment on table public.loan_schedule is 'Per-loan installment plan generated at disbursement.';
comment on table public.repayments is 'Money received against a loan, captured from employer remittance.';
comment on table public.remittance_batches is 'Monthly employer payroll-deduction batch (one per employer per period).';
