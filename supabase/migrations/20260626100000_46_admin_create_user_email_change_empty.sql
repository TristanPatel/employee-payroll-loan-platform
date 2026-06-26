-- Phase 6 / 46 — admin_create_user: also set auth.users.email_change to '' on INSERT.
--
-- Migration 43 set the six token columns (confirmation_token, recovery_token,
-- email_change_token_new, email_change_token_current, phone_change_token,
-- reauthentication_token) to '' on insert because GoTrue's Go driver
-- couldn't scan NULL into a non-nullable string and was 500'ing every sign-in.
--
-- I missed two: `email_change` and `phone_change` are also nullable text on
-- auth.users with the same Scan() problem. The active UAT just tripped it on
-- /token, /otp and /recover with:
--
--   500: Database error querying schema
--   sql: Scan error on column index 8, name "email_change":
--        converting NULL to string is unsupported
--
-- The five existing affected rows have already been backfilled live via a
-- one-shot UPDATE (idempotent). This migration patches admin_create_user so
-- the next admin-created account doesn't repeat the bug.

create or replace function public.admin_create_user(
  p_email       text,
  p_full_name   text,
  p_role        user_role,
  p_password    text,
  p_phone       text default null,
  p_employer_id uuid default null,
  p_branch_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_caller_role user_role;
  v_id          uuid := gen_random_uuid();
  v_email       text := lower(trim(p_email));
begin
  select role into v_caller_role from public.profiles
   where id = auth.uid() and deleted_at is null;
  if v_caller_role is distinct from 'master_admin' then
    raise exception 'only a master_admin can create accounts' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'enter a valid email address' using errcode = '22023';
  end if;
  if length(coalesce(p_password, '')) < 12 then
    raise exception 'temporary password must be at least 12 characters' using errcode = '22023';
  end if;
  if p_role in ('employer_admin', 'employer_signatory') and p_employer_id is null then
    raise exception 'employer roles must be linked to an employer' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'an account already exists for %', v_email using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user,
    -- GoTrue scans these into non-nullable strings; '' avoids the
    -- "Database error querying schema" sign-in failure. email_change and
    -- phone_change look like data columns (not tokens) but GoTrue treats
    -- them the same way — must not be NULL.
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current,
    email_change, phone_change,
    phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  update public.profiles
     set role        = p_role,
         full_name   = coalesce(nullif(trim(p_full_name), ''), full_name),
         phone       = nullif(trim(coalesce(p_phone, '')), ''),
         employer_id = case when p_role in ('employer_admin', 'employer_signatory')
                            then p_employer_id else null end,
         branch_id   = case when p_role in ('employer_admin', 'employer_signatory')
                            then null else p_branch_id end,
         is_active   = true,
         updated_at  = now()
   where id = v_id;

  perform public.log_event('admin.user_create', v_id, 'profile',
    jsonb_build_object('email', v_email, 'role', p_role::text));
  return v_id;
end;
$function$;
