-- Phase 4B / 20 — Auto-advance contract status on each signature insert.
--
-- After every INSERT into contract_signatures, recount signatures vs the
-- contract's required_signatories and update contracts.status accordingly:
--   0 sigs:  no change
--   1..N-1:  status = 'partially_signed'
--   N+:      status = 'fully_signed', set fully_signed_at
-- Sealing (PAdES + cert of completion + final PDF hash) is the next
-- step, performed by an Edge Function in Phase 4C; this trigger only
-- handles the in-database state machine.

create or replace function public.advance_contract_status_on_signature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_count integer;
  v_signed_count integer;
  v_current_status public.contract_status;
begin
  select
    array_length(required_signatories, 1),
    status
  into v_required_count, v_current_status
  from public.contracts
  where id = new.contract_id;

  if v_required_count is null then
    return new;
  end if;

  select count(distinct signatory_role) into v_signed_count
  from public.contract_signatures
  where contract_id = new.contract_id;

  if v_signed_count >= v_required_count then
    update public.contracts
    set status = 'fully_signed', fully_signed_at = now()
    where id = new.contract_id
      and status in ('draft','sent','partially_signed');
  elsif v_signed_count > 0 and v_current_status in ('draft','sent') then
    update public.contracts
    set status = 'partially_signed'
    where id = new.contract_id;
  end if;

  return new;
end;
$$;

create trigger trg_advance_contract_status_on_signature
after insert on public.contract_signatures
for each row execute function public.advance_contract_status_on_signature();

-- RPC the signing UI calls to atomically (a) record the audit event for
-- "consent given", "otp verified", "signed", (b) insert the signature row.
-- We do it as a SECURITY DEFINER function so the borrower can write
-- contract_audit_events even when the row's actor_profile_id is theirs but
-- the contract belongs to multiple parties. (RLS still applies — the
-- function checks the caller really is allowed to sign for that role.)
create or replace function public.sign_contract(
  p_contract_id uuid,
  p_signatory_role public.contract_signatory_role,
  p_consent_text text,
  p_signature_typed_name text,
  p_signature_image_path text,
  p_signature_drawn_points jsonb,
  p_authentication_method text,
  p_authentication_evidence jsonb,
  p_nrc_knowledge_check_passed boolean,
  p_ip inet,
  p_user_agent text,
  p_device_fingerprint text,
  p_geolocation jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_contract public.contracts;
  v_doc_hash text;
  v_envelope_hash text;
  v_signature_id uuid;
  v_payload jsonb;
begin
  if v_user is null then
    raise exception 'sign_contract: not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if v_profile is null or v_profile.deleted_at is not null then
    raise exception 'sign_contract: profile inactive';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract is null then
    raise exception 'sign_contract: contract not found';
  end if;
  if v_contract.status in ('sealed','voided','expired') then
    raise exception 'sign_contract: contract is %, cannot accept signatures', v_contract.status;
  end if;

  -- Role-vs-self check: borrower may only sign as borrower; others gated by role.
  if p_signatory_role = 'borrower' then
    if v_profile.role <> 'employee' then
      raise exception 'sign_contract: only the borrower (employee) may sign as borrower';
    end if;
  elsif p_signatory_role = 'employer_signatory' then
    if v_profile.role <> 'employer_signatory' then
      raise exception 'sign_contract: only an employer_signatory may sign that role';
    end if;
  elsif p_signatory_role = 'richmond_witness' then
    if v_profile.role not in ('master_admin','cse','branch_manager') then
      raise exception 'sign_contract: only Richmond staff may witness';
    end if;
  elsif p_signatory_role = 'cfo' then
    if v_profile.role <> 'cfo' then
      raise exception 'sign_contract: only CFO may sign as cfo';
    end if;
  end if;

  -- No duplicate signatures by role on the same contract
  if exists (
    select 1 from public.contract_signatures
    where contract_id = p_contract_id and signatory_role = p_signatory_role
  ) then
    raise exception 'sign_contract: signatory role % already signed', p_signatory_role;
  end if;

  v_doc_hash := coalesce(v_contract.document_sha256, '');
  v_envelope_hash := encode(
    digest(
      concat_ws('|',
        p_contract_id::text,
        p_signatory_role::text,
        v_user::text,
        v_doc_hash,
        p_signature_typed_name,
        now()::text
      ),
      'sha256'
    ),
    'hex'
  );

  v_payload := jsonb_build_object(
    'signatory_role', p_signatory_role::text,
    'authentication_method', p_authentication_method,
    'nrc_knowledge_check_passed', p_nrc_knowledge_check_passed
  );

  -- consent event
  insert into public.contract_audit_events
    (contract_id, event_type, actor_profile_id, ip, user_agent, payload)
  values
    (p_contract_id, 'consent_given', v_user, p_ip, p_user_agent,
     jsonb_build_object('consent_text', p_consent_text));

  -- signed event
  insert into public.contract_audit_events
    (contract_id, event_type, actor_profile_id, ip, user_agent, payload)
  values
    (p_contract_id, 'signed', v_user, p_ip, p_user_agent, v_payload);

  -- signature row (trigger auto-advances contract status)
  insert into public.contract_signatures (
    contract_id, signatory_role, signatory_profile_id,
    signatory_name_snapshot, signatory_nrc_snapshot,
    signatory_email_snapshot, signatory_phone_snapshot,
    consent_to_transact_electronically, consent_text_snapshot,
    consent_given_at, authentication_method, authentication_evidence,
    nrc_knowledge_check_passed, signature_image_path,
    signature_typed_name, signature_drawn_points,
    signed_at, ip_address, user_agent, device_fingerprint, geolocation,
    document_sha256_at_signing, envelope_sha256
  ) values (
    p_contract_id, p_signatory_role, v_user,
    v_profile.full_name, v_profile.nrc_no,
    v_profile.email, v_profile.phone,
    true, p_consent_text,
    now(), p_authentication_method, coalesce(p_authentication_evidence, '{}'::jsonb),
    p_nrc_knowledge_check_passed, p_signature_image_path,
    p_signature_typed_name, p_signature_drawn_points,
    now(), p_ip, p_user_agent, p_device_fingerprint, p_geolocation,
    v_doc_hash, v_envelope_hash
  ) returning id into v_signature_id;

  return v_signature_id;
end;
$$;

revoke execute on function public.sign_contract(uuid, public.contract_signatory_role, text, text, text, jsonb, text, jsonb, boolean, inet, text, text, jsonb) from anon;

comment on function public.sign_contract is
  'Atomic envelope-sealing entry point. Inserts the consent + signed audit events and the contract_signatures row in a single transaction. The contract status trigger then advances the contract automatically.';
