-- Phase 1.5 / 16 — Form-field extensions discovered during process review
-- (Payroll Application Form, Payroll Closure Form, Part B Loan Agreement v1.1).
--
-- Adds the columns the live Richmond forms actually capture but the original
-- Phase 1 schema omitted, plus a new `loan_closures` table for the closure
-- flow and an `handle_new_user` trigger that bootstraps `profiles` from
-- auth.users on first sign-in.

-- ─── New enums

create type public.salutation as enum ('mr', 'mrs', 'miss', 'dr', 'other');
create type public.employment_status as enum (
  'permanent', 'contract', 'temporal', 'suspension', 'terminated'
);
create type public.mode_of_payment as enum (
  'bank_transfer', 'standing_order', 'mobile_money', 'employer_internal'
);
create type public.loan_application_type as enum ('new_loan', 'refinancing');
create type public.refinancing_settlement_method as enum ('buyout', 'self_payment');

-- ─── profiles: salutation + name split + multiple phones + email + next of kin
alter table public.profiles
  add column salutation public.salutation,
  add column first_name text,
  add column middle_name text,
  add column surname text,
  add column home_phone text,
  add column office_phone text,
  add column email citext,
  add column next_of_kin_name text,
  add column next_of_kin_phone text,
  add column source_of_income text;

create unique index profiles_email_unique
  on public.profiles (email) where deleted_at is null and email is not null;

-- ─── employees: postal address + employment_status
alter table public.employees
  add column postal_address text,
  add column employment_status public.employment_status not null default 'permanent';

-- ─── loan_applications: currency, amount-in-words, mode of payment, loan type,
-- refinancing details
alter table public.loan_applications
  add column currency char(3) not null default 'ZMW',
  add column amount_in_words text,
  add column start_date_preferred date,
  add column mode_of_payment public.mode_of_payment,
  add column application_type public.loan_application_type not null default 'new_loan',
  add column refinancing_settlement_method public.refinancing_settlement_method,
  add column refinanced_from_loan_id uuid references public.loans (id) on delete restrict,
  add constraint loan_applications_refinancing_consistent check (
    application_type = 'new_loan'
    or (application_type = 'refinancing' and refinancing_settlement_method is not null)
  );

-- ─── Loan closures (Payroll Closure Form)
create table public.loan_closures (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null unique references public.loans (id) on delete restrict,
  employment_status public.employment_status not null,
  loan_fully_paid boolean not null default false,
  interest_settled boolean not null default false,
  no_outstanding_penalties boolean not null default false,
  loan_book_updated boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  disbursed_by uuid references public.profiles (id) on delete set null,
  disbursed_at timestamptz,
  closure_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create index loan_closures_loan_idx on public.loan_closures (loan_id) where deleted_at is null;

create trigger trg_loan_closures_touch before update on public.loan_closures
for each row execute function public.touch_updated_at();

alter table public.loan_closures enable row level security;

create policy loan_closures_select_owner on public.loan_closures for select to authenticated
  using (loan_id in (
    select l.id from public.loans l
    join public.employees e on e.id = l.employee_id
    where e.profile_id = auth.uid()
  ));
create policy loan_closures_select_employer on public.loan_closures for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and loan_id in (select id from public.loans where employer_id = public.current_user_employer())
  );
create policy loan_closures_select_staff on public.loan_closures for select to authenticated
  using (public.is_richmond_staff());
create policy loan_closures_write_staff on public.loan_closures for all to authenticated
  using (public.has_role(array['cse','branch_manager','accounts','cfo','master_admin']::public.user_role[]))
  with check (public.has_role(array['cse','branch_manager','accounts','cfo','master_admin']::public.user_role[]));

create trigger trg_audit_loan_closures after insert or update on public.loan_closures
for each row execute function public.audit_row_changes();

-- ─── handle_new_user trigger: bootstrap profile from auth.users on signup.
--
-- The signup UI submits role + (optional) employer_id / branch_id via
-- `raw_user_meta_data`. Master_admin must approve before role becomes active —
-- here we just create the row in an inactive state defaulting to 'employee'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_full_name text;
begin
  v_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'employee'::public.user_role
  );
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.email, ''),
    'New user'
  );

  insert into public.profiles (id, role, full_name, email, phone, is_active)
  values (
    new.id,
    v_role,
    v_full_name,
    new.email::citext,
    new.phone,
    case when v_role = 'employee' then true else false end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Auto-creates a public.profiles row from auth.users signup metadata. Staff/employer roles land inactive pending master_admin approval.';
