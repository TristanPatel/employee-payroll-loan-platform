-- Phase 1 / 07 — Employees (borrowers).
-- Salary stored in ngwee (1 K = 100 ngwee) for exact arithmetic.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete restrict,
  employer_id uuid not null references public.employers (id) on delete restrict,
  employee_no text not null,
  occupation text,
  department text,
  employment_start_date date,
  employment_end_date date,

  salary_basic_ngwee bigint not null default 0,
  salary_allowances_ngwee bigint not null default 0,

  bank_name text,
  bank_branch text,
  bank_account_type text,
  bank_account_no text,
  mobile_money_provider text,
  mobile_money_number text,

  residential_address text,
  residential_city text,
  residential_province text,
  marital_status text,
  gender text,
  date_of_birth date,
  nationality text not null default 'Zambian',

  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint employees_employee_no_per_employer_unique unique (employer_id, employee_no),
  constraint employees_salary_nonneg check (salary_basic_ngwee >= 0 and salary_allowances_ngwee >= 0)
);

create index employees_employer_idx on public.employees (employer_id) where deleted_at is null;

create trigger trg_employees_touch before update on public.employees
for each row execute function public.touch_updated_at();

comment on table public.employees is 'Employee borrower record. Linked 1:1 to a profile of role `employee`.';
comment on column public.employees.salary_basic_ngwee is 'Basic monthly pay in ngwee (×100 the K value). Used for NAPSA and NHIMA bases.';
