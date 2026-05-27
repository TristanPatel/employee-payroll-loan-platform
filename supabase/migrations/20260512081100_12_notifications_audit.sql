-- Phase 1 / 12 — Notifications, SMS log, generic audit log.
-- audit_log is append-only (RLS forbids UPDATE/DELETE; INSERT via SECURITY
-- DEFINER trigger func from other tables).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete set null,
  channel public.notification_channel not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'queued',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index notifications_recipient_idx on public.notifications (recipient_id) where deleted_at is null;
create index notifications_status_idx on public.notifications (status) where deleted_at is null;

create trigger trg_notifications_touch before update on public.notifications
for each row execute function public.touch_updated_at();

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  twilio_sid text,
  status text not null default 'queued',
  sent_at timestamptz,
  application_id uuid references public.loan_applications (id) on delete set null,
  loan_id uuid references public.loans (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index sms_log_to_phone_idx on public.sms_log (to_phone) where deleted_at is null;
create index sms_log_application_idx on public.sms_log (application_id) where deleted_at is null;
create index sms_log_loan_idx on public.sms_log (loan_id) where deleted_at is null;

create trigger trg_sms_log_touch before update on public.sms_log
for each row execute function public.touch_updated_at();

-- Generic audit log: every state-changing operation pipes here via SECURITY
-- DEFINER helpers. Master_admin and auditor can read; no one updates/deletes.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_occurred_at_idx on public.audit_log (occurred_at);

comment on table public.audit_log is
  'Append-only audit trail. RLS forbids UPDATE/DELETE. Insertions via SECURITY DEFINER helpers from state-changing functions.';
