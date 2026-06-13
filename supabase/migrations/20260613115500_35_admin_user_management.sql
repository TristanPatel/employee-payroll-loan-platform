-- ============================================================================
-- Migration 35 — back-office user management
--
-- Three master_admin-only RPCs that close the support gap:
--   admin_confirm_user      — mark the auth user's email as confirmed (skip
--                             the OTP loop entirely when a member of staff is
--                             struggling with email delivery).
--   admin_set_password      — set a bcrypt password (lets a member of staff
--                             keep a working password while we work things out).
--   admin_email_for_reset   — return the auth email so the server action can
--                             call supabase.auth.resetPasswordForEmail.
--
-- All three follow the same guard pattern as admin_delete_user: only a
-- master_admin from public.profiles may call, and they cannot target their
-- own row (avoids accidental lockout).
-- ============================================================================

create or replace function public.admin_confirm_user(p_profile_id uuid)
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
    raise exception 'only a master_admin can confirm users' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'use the normal sign-in flow for your own account'
      using errcode = '42501';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = '',
         confirmation_sent_at = null
   where id = p_profile_id;
end;
$$;

create or replace function public.admin_set_password(p_profile_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
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
end;
$$;

create or replace function public.admin_email_for_reset(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_role user_role;
  v_email text;
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can request password resets'
      using errcode = '42501';
  end if;
  select email::text into v_email from public.profiles where id = p_profile_id;
  return v_email;
end;
$$;

revoke execute on function public.admin_confirm_user(uuid)    from public, anon;
revoke execute on function public.admin_set_password(uuid,text) from public, anon;
revoke execute on function public.admin_email_for_reset(uuid) from public, anon;
grant  execute on function public.admin_confirm_user(uuid)    to authenticated, service_role;
grant  execute on function public.admin_set_password(uuid,text) to authenticated, service_role;
grant  execute on function public.admin_email_for_reset(uuid) to authenticated, service_role;
