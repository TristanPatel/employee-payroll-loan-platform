-- Phase 1 / 09 — Loan applications, supporting documents, approvals, due
-- diligence. Approvals follow the L1/L2/L3 tier rules in
-- docs/business-rules/approval-thresholds.md.

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text unique,
  employee_id uuid not null references public.employees (id) on delete restrict,
  employer_id uuid not null references public.employers (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,

  product public.loan_product not null default 'payroll_loan',
  requested_amount_ngwee bigint not null,
  requested_tenure_months smallint not null,
  purpose text,

  -- Snapshots captured at submission for reproducibility
  monthly_interest_rate numeric(6,4) not null,
  admin_fee_pct numeric(6,4) not null,
  insurance_fee_pct numeric(6,4) not null,
  net_pay_ngwee bigint,
  existing_obligations_ngwee bigint not null default 0,
  debt_ratio_pct numeric(6,4),

  status public.application_status not null default 'draft',

  -- Tier derivation captured at submission
  tier public.approval_tier,

  submitted_at timestamptz,
  decision_at timestamptz,
  decision_reason text,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint loan_applications_amount_pos check (requested_amount_ngwee > 0),
  constraint loan_applications_tenure_pos check (requested_tenure_months > 0),
  constraint loan_applications_rate_nonneg check (
    monthly_interest_rate >= 0 and admin_fee_pct >= 0 and insurance_fee_pct >= 0
  )
);

create index loan_applications_status_idx on public.loan_applications (status) where deleted_at is null;
create index loan_applications_employee_idx on public.loan_applications (employee_id) where deleted_at is null;
create index loan_applications_employer_idx on public.loan_applications (employer_id) where deleted_at is null;
create index loan_applications_branch_idx on public.loan_applications (branch_id) where deleted_at is null;

create trigger trg_loan_applications_touch before update on public.loan_applications
for each row execute function public.touch_updated_at();

comment on table public.loan_applications is
  'Employee-originated loan request. Moves through employer-confirm, CSE due diligence, L1/L2/L3 approval.';

-- Supporting documents
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete restrict,
  doc_type public.document_type not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index application_documents_application_idx
  on public.application_documents (application_id) where deleted_at is null;

create trigger trg_application_documents_touch before update on public.application_documents
for each row execute function public.touch_updated_at();

-- Approvals (one row per (application, tier, approver))
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete restrict,
  tier public.approval_tier not null,
  approver_id uuid not null references public.profiles (id) on delete restrict,
  decision public.approval_decision not null,
  notes text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Maker-checker: the approver cannot be the application creator.
  constraint approvals_no_self_approve check (true)
  -- (Enforced more strictly in RLS + a check trigger below.)
);

create unique index approvals_one_decision_per_tier
  on public.approvals (application_id, tier) where deleted_at is null;

create index approvals_application_idx on public.approvals (application_id) where deleted_at is null;

create trigger trg_approvals_touch before update on public.approvals
for each row execute function public.touch_updated_at();

-- Hard maker-checker: forbid self-approval and tier escalation by same person
create or replace function public.enforce_approval_maker_checker()
returns trigger
language plpgsql
as $$
declare
  v_creator uuid;
  v_lower_approvers uuid[];
begin
  select created_by into v_creator
  from public.loan_applications where id = new.application_id;

  if v_creator is not null and v_creator = new.approver_id then
    raise exception 'maker-checker: approver may not be the application creator';
  end if;

  select coalesce(array_agg(approver_id), array[]::uuid[]) into v_lower_approvers
  from public.approvals
  where application_id = new.application_id
    and tier < new.tier
    and decision = 'approve'
    and deleted_at is null;

  if new.approver_id = any (v_lower_approvers) then
    raise exception 'maker-checker: approver already approved a lower tier on this application';
  end if;

  return new;
end;
$$;

create trigger trg_approvals_maker_checker
before insert on public.approvals
for each row execute function public.enforce_approval_maker_checker();

-- Due-diligence checklist (one row per checklist item per application)
create table public.due_diligence_checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete restrict,
  phase smallint not null,                -- 1..5 matching the v1.3 PDF
  item_no smallint not null,              -- 1..23
  item_key text not null,                 -- e.g. 'application_form', 'nrc_verification'
  state text not null default 'pending',  -- pending | passed | failed
  severity text not null default 'info',  -- info | warn | block
  note text,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint due_diligence_checks_phase_range check (phase between 1 and 5),
  constraint due_diligence_checks_state_valid check (state in ('pending','passed','failed')),
  constraint due_diligence_checks_severity_valid check (severity in ('info','warn','block')),
  constraint due_diligence_checks_unique_item unique (application_id, item_no)
);

create index due_diligence_checks_application_idx
  on public.due_diligence_checks (application_id) where deleted_at is null;

create trigger trg_due_diligence_checks_touch before update on public.due_diligence_checks
for each row execute function public.touch_updated_at();

-- Sign-offs: CSE/Branch Officer, Branch Manager, Due Diligence Team
create table public.due_diligence_signoffs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete restrict,
  role_key text not null,                 -- 'cse' | 'branch_manager' | 'due_diligence'
  signer_id uuid not null references public.profiles (id) on delete restrict,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint due_diligence_signoffs_role_valid check (role_key in ('cse','branch_manager','due_diligence')),
  constraint due_diligence_signoffs_unique_per_role unique (application_id, role_key)
);

create index due_diligence_signoffs_application_idx
  on public.due_diligence_signoffs (application_id) where deleted_at is null;

create trigger trg_due_diligence_signoffs_touch before update on public.due_diligence_signoffs
for each row execute function public.touch_updated_at();

-- Enforce: CSE signer ≠ Branch Manager signer (maker-checker on due-diligence)
create or replace function public.enforce_dd_maker_checker()
returns trigger
language plpgsql
as $$
declare
  v_other uuid;
begin
  if new.role_key = 'branch_manager' then
    select signer_id into v_other
    from public.due_diligence_signoffs
    where application_id = new.application_id and role_key = 'cse' and deleted_at is null;
    if v_other = new.signer_id then
      raise exception 'maker-checker: branch manager sign-off cannot be the same person as CSE';
    end if;
  elsif new.role_key = 'cse' then
    select signer_id into v_other
    from public.due_diligence_signoffs
    where application_id = new.application_id and role_key = 'branch_manager' and deleted_at is null;
    if v_other = new.signer_id then
      raise exception 'maker-checker: CSE sign-off cannot be the same person as branch manager';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_dd_maker_checker
before insert on public.due_diligence_signoffs
for each row execute function public.enforce_dd_maker_checker();
