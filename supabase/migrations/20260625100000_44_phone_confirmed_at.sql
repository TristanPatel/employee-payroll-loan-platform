-- Phase 6 / 44 — phone_confirmed_at gate on loan_applications.
--
-- The apply wizard gains a phone-confirmation step (re-OTP via Twilio Verify)
-- between Documents and Amount, so the number we'll SMS for status updates
-- is proven live before the borrower can submit. The server-side check on
-- submitApplication() reads this column; UI cannot bypass it.
--
-- No backfill: existing applications were submitted before phone-confirm
-- existed, so they leave this column NULL. The submit gate only applies to
-- new submissions; status=submitted rows pre-this-migration are untouched.

alter table public.loan_applications
  add column if not exists phone_confirmed_at timestamptz;

comment on column public.loan_applications.phone_confirmed_at is
  'Set when the borrower verified the phone number on the apply wizard via Twilio Verify. NULL means the application has not yet cleared the phone-confirm step.';
