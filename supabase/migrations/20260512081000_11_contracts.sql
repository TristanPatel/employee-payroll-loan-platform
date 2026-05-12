-- Phase 1 / 11 — Digital contract execution + evidence chain (Section 9A).
--
-- Once a contract is sealed:
--   • contract_signatures rows are INSERT-only (RLS blocks UPDATE/DELETE)
--   • contract_audit_events rows are INSERT-only
--   • contracts.status moves forward only (enforced by trigger below)
-- This locks the evidence chain so it can be exported to court if needed.

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,                -- e.g. 'loan_agreement_v1'
  version integer not null,
  name text not null,
  body_html text not null,
  variables jsonb not null default '{}'::jsonb,
  required_signatories public.contract_signatory_role[] not null,
  effective_from timestamptz,
  effective_to timestamptz,
  published_at timestamptz,
  storage_path_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,

  constraint contract_templates_unique_version unique (template_key, version)
);

create index contract_templates_key_idx on public.contract_templates (template_key) where deleted_at is null;

create trigger trg_contract_templates_touch before update on public.contract_templates
for each row execute function public.touch_updated_at();

-- Once published, immutable
create or replace function public.enforce_template_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.published_at is not null and (
    new.body_html is distinct from old.body_html
    or new.variables is distinct from old.variables
    or new.required_signatories is distinct from old.required_signatories
    or new.template_key is distinct from old.template_key
    or new.version is distinct from old.version
  ) then
    raise exception 'contract template is immutable once published; create a new version instead';
  end if;
  return new;
end;
$$;

create trigger trg_contract_templates_immutable
before update on public.contract_templates
for each row execute function public.enforce_template_immutable();

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans (id) on delete restrict,
  application_id uuid references public.loan_applications (id) on delete restrict,
  contract_type public.contract_type not null,
  template_id uuid not null references public.contract_templates (id) on delete restrict,
  template_version integer not null,
  status public.contract_status not null default 'draft',
  document_storage_path text,
  document_sha256 text,
  template_storage_path text,
  required_signatories public.contract_signatory_role[] not null,
  fully_signed_at timestamptz,
  fully_signed_pdf_path text,
  fully_signed_pdf_sha256 text,
  certificate_of_completion_path text,
  expires_at timestamptz,
  voided_at timestamptz,
  voided_reason text,
  voided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint contracts_linkage_present check (loan_id is not null or application_id is not null)
);

create index contracts_loan_idx on public.contracts (loan_id);
create index contracts_application_idx on public.contracts (application_id);
create index contracts_status_idx on public.contracts (status);

create trigger trg_contracts_touch before update on public.contracts
for each row execute function public.touch_updated_at();

-- Status can only move forward; voided is allowed from any non-sealed state.
create or replace function public.enforce_contract_status_forward()
returns trigger
language plpgsql
as $$
declare
  v_order int[] := array[1,2,3,4,5,6,7]; -- placeholder
  v_old int;
  v_new int;
begin
  if old.status = new.status then return new; end if;
  v_old := case old.status
    when 'draft' then 1 when 'sent' then 2 when 'partially_signed' then 3
    when 'fully_signed' then 4 when 'sealed' then 5
    when 'expired' then 6 when 'voided' then 7
  end;
  v_new := case new.status
    when 'draft' then 1 when 'sent' then 2 when 'partially_signed' then 3
    when 'fully_signed' then 4 when 'sealed' then 5
    when 'expired' then 6 when 'voided' then 7
  end;
  if new.status = 'voided' then
    if old.status = 'sealed' then
      raise exception 'sealed contract may not be voided';
    end if;
    return new;
  end if;
  if v_new < v_old then
    raise exception 'contract status may only move forward (% -> %)', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger trg_contracts_status_forward
before update of status on public.contracts
for each row execute function public.enforce_contract_status_forward();

-- Sealed contract metadata is also immutable
create or replace function public.enforce_contract_sealed_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'sealed' and (
    new.document_sha256 is distinct from old.document_sha256
    or new.fully_signed_pdf_path is distinct from old.fully_signed_pdf_path
    or new.fully_signed_pdf_sha256 is distinct from old.fully_signed_pdf_sha256
    or new.certificate_of_completion_path is distinct from old.certificate_of_completion_path
    or new.template_id is distinct from old.template_id
    or new.template_version is distinct from old.template_version
  ) then
    raise exception 'sealed contract document fields are immutable';
  end if;
  return new;
end;
$$;

create trigger trg_contracts_sealed_immutable
before update on public.contracts
for each row execute function public.enforce_contract_sealed_immutable();

-- INSERT-ONLY: contract_signatures
create table public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete restrict,
  signatory_role public.contract_signatory_role not null,
  signatory_profile_id uuid not null references public.profiles (id) on delete restrict,
  signatory_name_snapshot text not null,
  signatory_nrc_snapshot citext,
  signatory_email_snapshot citext,
  signatory_phone_snapshot text,
  consent_to_transact_electronically boolean not null,
  consent_text_snapshot text not null,
  consent_given_at timestamptz not null,
  authentication_method text not null,                -- 'otp' | 'mfa' | 'password'
  authentication_evidence jsonb not null default '{}'::jsonb,
  nrc_knowledge_check_passed boolean not null,
  signature_image_path text,
  signature_typed_name text not null,
  signature_drawn_points jsonb,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  geolocation jsonb,
  document_sha256_at_signing text not null,
  envelope_sha256 text not null,
  created_at timestamptz not null default now()
);

create index contract_signatures_contract_idx on public.contract_signatures (contract_id);
create index contract_signatures_profile_idx on public.contract_signatures (signatory_profile_id);

-- INSERT-ONLY: contract_audit_events
create table public.contract_audit_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete restrict,
  event_type public.contract_audit_event_type not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index contract_audit_events_contract_idx on public.contract_audit_events (contract_id);
create index contract_audit_events_type_idx on public.contract_audit_events (event_type);
create index contract_audit_events_occurred_at_idx on public.contract_audit_events (occurred_at);

comment on table public.contract_signatures is
  'INSERT-only ledger of each signatory event. RLS forbids UPDATE/DELETE. Evidence for ECT Act 2021 enforcement.';
comment on table public.contract_audit_events is
  'INSERT-only timeline of every interaction with a contract (viewed, otp, signed, voided, sealed). RLS forbids UPDATE/DELETE.';
