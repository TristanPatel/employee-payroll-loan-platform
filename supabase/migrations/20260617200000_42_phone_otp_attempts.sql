-- Phase 6 / 42 — Twilio Verify phone-OTP audit + rate-limit table.
--
-- Borrower-side phone OTP runs in two edge functions:
--   phone-otp-start  → POST verify.twilio.com/.../Verifications
--   phone-otp-verify → POST verify.twilio.com/.../VerificationCheck, then
--                      create/link Supabase auth user + return a magic link
--
-- Twilio Verify already enforces server-side rate limits, but we layer a
-- second defence here so a misconfigured or compromised Service SID doesn't
-- silently rack up SMS costs. Every start and verify call writes one row.

create table public.phone_otp_attempts (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,                  -- E.164, normalised
  ip          inet,
  user_agent  text,
  action      text not null check (action in ('start','verify')),
  outcome     text not null check (outcome in ('sent','verified','denied','rate_limited','error')),
  detail      text,                            -- short error message when outcome != ok
  created_at  timestamptz not null default now()
);

create index phone_otp_attempts_phone_recent_idx
  on public.phone_otp_attempts (phone, created_at desc);

create index phone_otp_attempts_outcome_idx
  on public.phone_otp_attempts (outcome, created_at desc);

alter table public.phone_otp_attempts enable row level security;

-- The only consumer of these rows is the master_admin observability dashboard
-- and the auditor. Borrowers never see them; their UI only sees the API
-- response. Edge functions write via service_role, which bypasses RLS.
create policy phone_otp_attempts_select_master on public.phone_otp_attempts
  for select to authenticated using ( public.is_master_admin() or public.is_auditor() );
