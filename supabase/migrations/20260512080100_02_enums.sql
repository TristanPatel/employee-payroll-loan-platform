-- Phase 1 / 02 — Enum types.
-- Centralised so every table that references a state shares the same vocabulary.

create type public.user_role as enum (
  'master_admin',
  'branch_manager',
  'cse',
  'approver_l1',
  'approver_l2',
  'accounts',
  'cfo',
  'auditor',
  'employer_admin',
  'employer_signatory',
  'employee'
);

create type public.entity_status as enum ('active', 'suspended', 'archived');

create type public.application_status as enum (
  'draft',
  'submitted',
  'employer_review',
  'employer_confirmed',
  'cse_review',
  'l1_pending',
  'l2_pending',
  'l3_pending',
  'approved',
  'rejected',
  'expired',
  'withdrawn'
);

create type public.approval_tier as enum ('l1', 'l2', 'l3');

create type public.approval_decision as enum ('approve', 'reject', 'request_info');

create type public.loan_status as enum (
  'pending_disbursement',
  'active',
  'in_arrears',
  'settled',
  'written_off',
  'voided'
);

create type public.loan_product as enum (
  'payroll_loan',
  'salary_advance',
  'top_up'
);

create type public.schedule_status as enum (
  'scheduled',
  'deducted',
  'remitted',
  'partial',
  'missed'
);

create type public.remittance_status as enum (
  'draft',
  'sent',
  'partially_received',
  'fully_received',
  'reconciled'
);

create type public.contract_type as enum (
  'pre_approval',
  'offer_letter',
  'loan_agreement',
  'employee_authorisation',
  'settlement_acknowledgement',
  'top_up_addendum'
);

create type public.contract_status as enum (
  'draft',
  'sent',
  'partially_signed',
  'fully_signed',
  'sealed',
  'voided',
  'expired'
);

create type public.contract_signatory_role as enum (
  'borrower',
  'employer_signatory',
  'richmond_witness',
  'cfo'
);

create type public.contract_audit_event_type as enum (
  'created',
  'sent',
  'viewed',
  'downloaded',
  'consent_given',
  'otp_requested',
  'otp_verified',
  'otp_failed',
  'nrc_check_passed',
  'nrc_check_failed',
  'signed',
  'declined',
  'voided',
  'completed',
  'sealed',
  'evidence_exported'
);

create type public.document_type as enum (
  'nrc_front',
  'nrc_back',
  'photo',
  'employment_contract',
  'payslip_1',
  'payslip_2',
  'payslip_3',
  'bank_proof',
  'residence_proof',
  'mou',
  'pop',
  'specimen_signature',
  'other'
);

create type public.notification_channel as enum (
  'sms',
  'push',
  'email',
  'in_app'
);

create type public.notification_status as enum (
  'queued',
  'sent',
  'delivered',
  'failed'
);
