-- ============================================================================
-- Migration 38 — admin "sign out everywhere"
--
-- Deletes all of a user's auth sessions (which cascades to their refresh
-- tokens), so every device is logged out and cannot refresh. Existing access
-- tokens remain valid until they expire (<= 1h by config), then the user must
-- sign in again. master_admin only; logged to the activity feed.
-- ============================================================================
create or replace function public.admin_signout_user(p_profile_id uuid)
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
    raise exception 'only a master_admin can sign users out' using errcode = '42501';
  end if;

  delete from auth.sessions where user_id = p_profile_id;
  perform public.log_event('admin.signout_everywhere', p_profile_id, 'profile');
end;
$$;

revoke execute on function public.admin_signout_user(uuid) from public, anon;
grant  execute on function public.admin_signout_user(uuid) to authenticated, service_role;
