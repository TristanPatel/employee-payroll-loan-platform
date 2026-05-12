-- Phase 1 / 04 — Richmond Finance branches.
-- 2-char branch_code drives loan number formatting (RFL{branchCode}{seq6}).
-- legacy_code retains the 4-digit token used by the historical xlsm loan
-- generator for reconciliation against old paper files.

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch_code char(2) not null,
  legacy_code text,
  town text not null,
  province text not null,
  manager_id uuid,
  status public.entity_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  constraint branches_branch_code_uppercase check (branch_code = upper(branch_code)),
  constraint branches_branch_code_unique unique (branch_code)
);

create index branches_status_idx on public.branches (status) where deleted_at is null;

create trigger trg_branches_touch
before update on public.branches
for each row execute function public.touch_updated_at();

comment on table public.branches is 'Richmond Finance physical branch network (Lusaka HQ, Kitwe, Ndola, …).';
comment on column public.branches.branch_code is '2-char code embedded in loan numbers, e.g. LS / KT / ND. Always uppercase.';
comment on column public.branches.legacy_code is 'Old 4-digit token (e.g. ''4624'' for Kitwe) preserved for paper-file reconciliation.';
