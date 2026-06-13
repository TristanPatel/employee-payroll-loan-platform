-- ============================================================================
-- Migration 34 — master_admin user deletion
--
-- "Delete" on a regulated lending platform = soft-delete the profile (so the
-- person vanishes from every list and loses app access) + ban the auth user
-- (so they cannot mint a new session). The profiles row is kept because every
-- loan / application / approval / audit FK references it (ON DELETE RESTRICT),
-- and BoZ requires the history to remain intact. Reversible via
-- admin_restore_user.
-- ============================================================================

create or replace function public.admin_delete_user(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
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
  if v_target.deleted_at is not null then
    return;  -- already deleted; idempotent
  end if;

  -- Never remove the last working master_admin.
  if v_target.role = 'master_admin' then
    select count(*) into v_active_masters
      from public.profiles
     where role = 'master_admin' and is_active and deleted_at is null;
    if v_active_masters <= 1 then
      raise exception 'cannot delete the last active master_admin' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set deleted_at = now(), is_active = false, updated_at = now()
   where id = p_profile_id;

  -- Revoke login. Keep the auth.users row (profiles FK is ON DELETE RESTRICT
  -- and audit history must survive).
  update auth.users
     set banned_until = 'infinity'::timestamptz
   where id = p_profile_id;
end;
$$;

create or replace function public.admin_restore_user(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
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
end;
$$;

revoke execute on function public.admin_delete_user(uuid)  from public, anon;
revoke execute on function public.admin_restore_user(uuid) from public, anon;
grant  execute on function public.admin_delete_user(uuid)  to authenticated, service_role;
grant  execute on function public.admin_restore_user(uuid) to authenticated, service_role;
