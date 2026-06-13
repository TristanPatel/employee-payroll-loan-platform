-- ============================================================================
-- Migration 36 — full activity audit
--
-- Extends the existing audit_log so the super admin can answer:
--   "what did this person do?", "what changed on this loan?",
--   "who signed in today?", "who reset whose password?"
--
-- Adds audit_row_changes triggers to every remaining people/configuration
-- table, and a log_event RPC that captures sign-ins, sign-outs, and
-- privileged admin actions with the same shape so a single feed serves
-- everything.
-- ============================================================================

-- 1) Audit the remaining people/configuration tables
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','employees','employers','branches',
    'due_diligence_checks','employer_signatories','contract_signatures',
    'notifications'
  ] loop
    if not exists (
      select 1 from information_schema.tables
       where table_schema='public' and table_name=t
    ) then continue; end if;
    if not exists (
      select 1 from information_schema.triggers
       where trigger_schema='public' and event_object_table=t
         and trigger_name = 'trg_audit_' || t
    ) then
      execute format(
        'create trigger trg_audit_%I after insert or update on public.%I '
        'for each row execute function public.audit_row_changes()', t, t);
    end if;
  end loop;
end$$;

-- 2) Single RPC for non-row events (sign-ins, sign-outs, admin actions).
create or replace function public.log_event(
  p_kind text,
  p_entity_id uuid default null,
  p_entity_type text default null,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.write_audit(
    p_kind,
    coalesce(p_entity_type, 'session'),
    coalesce(p_entity_id, auth.uid()),
    null,
    p_details || jsonb_build_object('actor', auth.uid())
  );
end;
$$;

revoke execute on function public.log_event(text, uuid, text, jsonb) from public, anon;
grant  execute on function public.log_event(text, uuid, text, jsonb) to authenticated, service_role;

-- 3) Each admin RPC logs an explicit event in addition to its row audit. The
-- bodies match what's running in production; re-asserted here so a fresh DB
-- replay produces the same shape.

create or replace function public.admin_delete_user(p_profile_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_caller_role user_role;
  v_target public.profiles%rowtype;
  v_active_masters int;
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can delete users' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'you cannot delete your own account' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'user % not found', p_profile_id using errcode = 'P0002';
  end if;
  if v_target.deleted_at is not null then return; end if;
  if v_target.role = 'master_admin' then
    select count(*) into v_active_masters from public.profiles
     where role = 'master_admin' and is_active and deleted_at is null;
    if v_active_masters <= 1 then
      raise exception 'cannot delete the last active master_admin' using errcode = '42501';
    end if;
  end if;
  update public.profiles
     set deleted_at = now(), is_active = false, updated_at = now()
   where id = p_profile_id;
  update auth.users set banned_until = 'infinity'::timestamptz where id = p_profile_id;
  perform public.log_event('admin.user_delete', p_profile_id, 'profile',
    jsonb_build_object('target_email', v_target.email, 'target_role', v_target.role));
end;
$$;

create or replace function public.admin_restore_user(p_profile_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_caller_role user_role;
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can restore users' using errcode = '42501';
  end if;
  update public.profiles
     set deleted_at = null, is_active = true, updated_at = now()
   where id = p_profile_id;
  update auth.users set banned_until = null where id = p_profile_id;
  perform public.log_event('admin.user_restore', p_profile_id, 'profile');
end;
$$;

create or replace function public.admin_confirm_user(p_profile_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_caller_role user_role;
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can confirm users' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'use the normal sign-in flow for your own account'
      using errcode = '42501';
  end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = '', confirmation_sent_at = null
   where id = p_profile_id;
  perform public.log_event('admin.user_confirm', p_profile_id, 'profile');
end;
$$;

create or replace function public.admin_set_password(p_profile_id uuid, p_password text)
returns void
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare v_caller_role user_role;
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can set passwords' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'change your own password through the normal flow'
      using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 12 then
    raise exception 'password must be at least 12 characters' using errcode = '22023';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_profile_id;
  perform public.log_event('admin.password_set', p_profile_id, 'profile');
end;
$$;

-- 4) audit_log read policy — staff + auditor see everything.
alter table public.audit_log enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policy where polrelid='public.audit_log'::regclass
       and polname='audit_select_staff'
  ) then
    create policy audit_select_staff on public.audit_log
      for select to authenticated using (is_richmond_staff() or is_auditor());
  end if;
end $$;
