-- ============================================================================
-- 25_push_notifications.sql
--
-- Phase 9 — Expo push notifications:
--   • profiles.expo_push_token — most recent Expo push token captured
--     from the mobile app on sign-in.
--   • register_push_token(token) — RPC that lets the mobile app upsert
--     its own push token without exposing the profiles table to write
--     access generally.
-- ============================================================================

alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists push_token_updated_at timestamptz;

create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 10 then
    raise exception 'invalid push token' using errcode = '22023';
  end if;
  update public.profiles
     set expo_push_token = p_token,
         push_token_updated_at = now()
   where id = auth.uid();
end;
$$;
grant execute on function public.register_push_token(text) to authenticated;

-- The notify() helper already inserts a row per channel; the
-- notification-worker filters by channel in ('sms','email'). Phase 9
-- redeploys the worker to also handle channel='push', reading
-- profiles.expo_push_token and POSTing to the Expo Push API.
