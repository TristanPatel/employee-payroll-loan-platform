-- Phase 1 / 06 — Profiles linked to auth.users.
-- Every signed-in user has exactly one profile carrying their role and
-- optional FKs to branch (staff) or employer (employer HR).
-- Helpers used by RLS policies are added here once profiles exists.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  role public.user_role not null,
  full_name text not null,
  phone text,
  nrc_no citext,
  branch_id uuid references public.branches (id) on delete restrict,
  employer_id uuid references public.employers (id) on delete restrict,
  is_active boolean not null default true,
  mfa_enrolled boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,

  -- Branch/employer coherence: staff roles have branch, employer roles have
  -- employer, employee has employer. CFO, master_admin, auditor sit outside
  -- branch/employer scoping.
  constraint profiles_branch_for_branch_roles check (
    branch_id is null
    or role = any (array['branch_manager','cse','approver_l1','approver_l2','accounts']::public.user_role[])
  ),
  constraint profiles_employer_for_employer_roles check (
    employer_id is null
    or role = any (array['employer_admin','employer_signatory','employee']::public.user_role[])
  )
);

create unique index profiles_nrc_unique on public.profiles (nrc_no) where deleted_at is null and nrc_no is not null;
create index profiles_role_idx on public.profiles (role) where deleted_at is null;
create index profiles_branch_idx on public.profiles (branch_id) where deleted_at is null;
create index profiles_employer_idx on public.profiles (employer_id) where deleted_at is null;

create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

comment on table public.profiles is 'Per-user role and scoping. One row per auth.users entry.';
comment on column public.profiles.nrc_no is 'Zambian NRC; unique among active profiles. Stored as citext for case-insensitive matching during signing flows.';

-- ─── Now: role-aware RLS helper functions (security definer so they can read
-- profiles regardless of caller's own RLS).

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

create or replace function public.current_user_branch()
returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid() and deleted_at is null;
$$;

create or replace function public.current_user_employer()
returns uuid
language sql stable security definer set search_path = public as $$
  select employer_id from public.profiles where id = auth.uid() and deleted_at is null;
$$;

create or replace function public.has_role(roles public.user_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and deleted_at is null
    and is_active = true
    and role = any (roles)
  );
$$;

create or replace function public.is_richmond_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array[
    'master_admin','branch_manager','cse','approver_l1','approver_l2',
    'accounts','cfo','auditor'
  ]::public.user_role[]);
$$;

create or replace function public.is_master_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['master_admin']::public.user_role[]);
$$;

create or replace function public.is_auditor()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['auditor']::public.user_role[]);
$$;

-- branches.manager_id FK now that profiles exists
alter table public.branches
  add constraint branches_manager_id_fk foreign key (manager_id)
  references public.profiles (id) on delete set null;
