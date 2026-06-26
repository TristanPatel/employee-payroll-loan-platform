-- Phase 6 / 45 — application_payslip_ocr table for Claude-vision payslip OCR.
--
-- When a borrower uploads payslip_1 / payslip_2 / payslip_3, the apply wizard
-- fires the payslip-ocr edge function, which sends the image/PDF to Claude
-- vision and asks for a structured extraction via a single tool call. The
-- function persists one row per attempt here.
--
-- Soft-fail design: on failure we insert a row with status='failed' + error
-- message rather than nothing, so the CSE can see "we tried" and the system
-- has a complete audit trail of every OCR call (including Anthropic API
-- failures, low-confidence rejections, and non-payslip uploads).
--
-- Money fields are bigint ngwee (1 ZMW = 100 ngwee) for consistency with
-- the rest of the schema.

create table public.application_payslip_ocr (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.loan_applications(id) on delete cascade,
  document_id     uuid references public.application_documents(id) on delete set null,
  doc_type        public.document_type not null,

  -- Extracted figures (all NULL when status='failed').
  gross_ngwee     bigint,
  basic_ngwee     bigint,
  paye_ngwee      bigint,
  napsa_ngwee     bigint,
  nhima_ngwee     bigint,
  net_ngwee       bigint,
  period_month    date,                       -- first of month, e.g. 2026-05-01
  employer_name   text,
  confidence      numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),

  -- Outcome of the OCR call.
  status          text not null check (status in ('ok','failed')),
  error_message   text,
  ocr_model       text,                       -- 'claude-sonnet-4' etc.

  created_at      timestamptz not null default now()
);

create index application_payslip_ocr_application_idx
  on public.application_payslip_ocr (application_id);

create index application_payslip_ocr_doc_idx
  on public.application_payslip_ocr (document_id) where document_id is not null;

alter table public.application_payslip_ocr enable row level security;

-- Richmond staff (CSE / approvers / accounts / CFO / auditor / master) see
-- everything — they need the OCR figures to cross-check against the payslip
-- image during DD.
create policy application_payslip_ocr_select_staff on public.application_payslip_ocr
  for select to authenticated using ( public.is_richmond_staff() );

-- Borrower sees their own application's OCR rows (for the "we read K15,234
-- net pay" inline feedback after upload).
create policy application_payslip_ocr_select_owner on public.application_payslip_ocr
  for select to authenticated using (
    application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
  );

-- Employer signatory / admin sees OCR for applications under their employer
-- scope. Matches the parallel pattern on application_documents (migration 14).
create policy application_payslip_ocr_select_employer on public.application_payslip_ocr
  for select to authenticated using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and application_id in (
      select id from public.loan_applications
      where employer_id = public.current_user_employer()
    )
  );

-- Writes only from the edge function (service_role bypasses RLS). No
-- authenticated client should ever insert here directly.
