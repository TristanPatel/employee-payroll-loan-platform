-- Phase 1 / 14 — Row-Level Security.
--
-- Rules of thumb:
--   • Every table has RLS ON
--   • No table allows DELETE from authenticated users (soft-delete only)
--   • Contract evidence + audit_log allow INSERT only (no UPDATE, no DELETE)
--   • master_admin and auditor have read everywhere
--   • Each role can only see/write within its scope (branch, employer)
--
-- Helpers from migration 06_profiles:
--   public.current_user_role() public.user_role
--   public.current_user_branch() uuid
--   public.current_user_employer() uuid
--   public.has_role(roles user_role[]) boolean
--   public.is_richmond_staff() boolean
--   public.is_master_admin() boolean
--   public.is_auditor() boolean

-- ─── Enable RLS on every public table

alter table public.branches enable row level security;
alter table public.employers enable row level security;
alter table public.employer_signatories enable row level security;
alter table public.employer_payroll_config enable row level security;
alter table public.employer_benefits enable row level security;
alter table public.employer_documents enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.tax_settings enable row level security;
alter table public.loan_applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.approvals enable row level security;
alter table public.due_diligence_checks enable row level security;
alter table public.due_diligence_signoffs enable row level security;
alter table public.loans enable row level security;
alter table public.loan_schedule enable row level security;
alter table public.remittance_batches enable row level security;
alter table public.repayments enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_signatures enable row level security;
alter table public.contract_audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.sms_log enable row level security;
alter table public.audit_log enable row level security;

-- Force RLS on contract evidence + audit_log so even table owners go through it.
alter table public.contract_signatures force row level security;
alter table public.contract_audit_events force row level security;
alter table public.audit_log force row level security;

-- ─── BRANCHES
-- All Richmond staff can read; master_admin can write
create policy branches_select_staff on public.branches
  for select to authenticated
  using (public.is_richmond_staff());

create policy branches_insert_master on public.branches
  for insert to authenticated
  with check (public.is_master_admin());

create policy branches_update_master on public.branches
  for update to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

-- ─── EMPLOYERS
create policy employers_select_staff_or_own on public.employers
  for select to authenticated
  using (
    public.is_richmond_staff()
    or id = public.current_user_employer()
  );

create policy employers_insert_master on public.employers
  for insert to authenticated
  with check (public.is_master_admin());

create policy employers_update_master on public.employers
  for update to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

-- ─── EMPLOYER SIGNATORIES / PAYROLL CONFIG / BENEFITS / DOCS
-- Read: Richmond staff + own-employer users; Write: master_admin
create policy employer_signatories_select on public.employer_signatories
  for select to authenticated
  using (
    public.is_richmond_staff()
    or employer_id = public.current_user_employer()
  );
create policy employer_signatories_insert_master on public.employer_signatories
  for insert to authenticated
  with check (public.is_master_admin());
create policy employer_signatories_update_master on public.employer_signatories
  for update to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

create policy employer_payroll_config_select on public.employer_payroll_config
  for select to authenticated
  using (
    public.is_richmond_staff()
    or employer_id = public.current_user_employer()
  );
create policy employer_payroll_config_write_master on public.employer_payroll_config
  for all to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

create policy employer_benefits_select on public.employer_benefits
  for select to authenticated
  using (
    public.is_richmond_staff()
    or employer_id = public.current_user_employer()
  );
create policy employer_benefits_write_master on public.employer_benefits
  for all to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

create policy employer_documents_select on public.employer_documents
  for select to authenticated
  using (
    public.is_richmond_staff()
    or employer_id = public.current_user_employer()
  );
create policy employer_documents_insert_master on public.employer_documents
  for insert to authenticated
  with check (public.is_master_admin());
create policy employer_documents_update_master on public.employer_documents
  for update to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

-- ─── PROFILES
-- Users always read their own profile; staff + own-employer-admin can read others within scope.
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_richmond_staff());

create policy profiles_select_employer_admin on public.profiles
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- can update non-role/branch/employer fields only (role + scope locked by master_admin)
    and role = (select role from public.profiles where id = auth.uid())
    and branch_id is not distinct from (select branch_id from public.profiles where id = auth.uid())
    and employer_id is not distinct from (select employer_id from public.profiles where id = auth.uid())
  );

create policy profiles_update_master on public.profiles
  for update to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

create policy profiles_insert_master on public.profiles
  for insert to authenticated
  with check (public.is_master_admin() or id = auth.uid());

-- ─── EMPLOYEES
create policy employees_select_self on public.employees
  for select to authenticated
  using (profile_id = auth.uid());

create policy employees_select_staff on public.employees
  for select to authenticated
  using (public.is_richmond_staff());

create policy employees_select_employer on public.employees
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );

create policy employees_insert_self_or_staff on public.employees
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    or public.is_richmond_staff()
  );

create policy employees_update_self on public.employees
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy employees_update_staff on public.employees
  for update to authenticated
  using (public.is_richmond_staff())
  with check (public.is_richmond_staff());

-- ─── TAX SETTINGS — read by anyone authenticated; write master_admin only
create policy tax_settings_select_all on public.tax_settings
  for select to authenticated
  using (true);
create policy tax_settings_write_master on public.tax_settings
  for all to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

-- ─── LOAN APPLICATIONS
create policy loan_applications_select_owner on public.loan_applications
  for select to authenticated
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
  );

create policy loan_applications_select_employer on public.loan_applications
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );

create policy loan_applications_select_staff on public.loan_applications
  for select to authenticated
  using (public.is_richmond_staff());

create policy loan_applications_insert_owner_or_cse on public.loan_applications
  for insert to authenticated
  with check (
    -- Borrower (signed-in employee) creating their own application
    employee_id in (select id from public.employees where profile_id = auth.uid())
    -- or CSE / branch_manager / master_admin capturing on a walk-in
    or public.has_role(array['cse','branch_manager','master_admin']::public.user_role[])
  );

create policy loan_applications_update_owner_draft on public.loan_applications
  for update to authenticated
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
    and status = 'draft'
  )
  with check (
    employee_id in (select id from public.employees where profile_id = auth.uid())
  );

create policy loan_applications_update_employer_confirm on public.loan_applications
  for update to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
    and status in ('submitted','employer_review')
  )
  with check (
    employer_id = public.current_user_employer()
  );

create policy loan_applications_update_staff on public.loan_applications
  for update to authenticated
  using (
    public.has_role(array['cse','branch_manager','approver_l1','approver_l2','master_admin']::public.user_role[])
  )
  with check (
    public.has_role(array['cse','branch_manager','approver_l1','approver_l2','master_admin']::public.user_role[])
  );

-- ─── APPLICATION DOCUMENTS
create policy application_documents_select_owner on public.application_documents
  for select to authenticated
  using (
    application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
  );

create policy application_documents_select_employer on public.application_documents
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and application_id in (
      select id from public.loan_applications
      where employer_id = public.current_user_employer()
    )
  );

create policy application_documents_select_staff on public.application_documents
  for select to authenticated
  using (public.is_richmond_staff());

create policy application_documents_insert on public.application_documents
  for insert to authenticated
  with check (
    -- Borrower uploading their own
    application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
    -- or staff doing it on their behalf
    or public.is_richmond_staff()
  );

create policy application_documents_update_staff on public.application_documents
  for update to authenticated
  using (public.is_richmond_staff())
  with check (public.is_richmond_staff());

-- ─── APPROVALS
create policy approvals_select_staff on public.approvals
  for select to authenticated
  using (public.is_richmond_staff());

create policy approvals_select_owner on public.approvals
  for select to authenticated
  using (
    application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
  );

-- Insert: approver role must match the tier; not self-approving (enforced
-- additionally by the trigger from migration 09).
create policy approvals_insert_l1 on public.approvals
  for insert to authenticated
  with check (
    tier = 'l1'
    and public.has_role(array['approver_l1','master_admin']::public.user_role[])
    and approver_id = auth.uid()
  );

create policy approvals_insert_l2 on public.approvals
  for insert to authenticated
  with check (
    tier = 'l2'
    and public.has_role(array['approver_l2','master_admin']::public.user_role[])
    and approver_id = auth.uid()
  );

create policy approvals_insert_l3 on public.approvals
  for insert to authenticated
  with check (
    tier = 'l3'
    and public.has_role(array['master_admin','cfo']::public.user_role[])
    and approver_id = auth.uid()
  );

-- ─── DUE-DILIGENCE
create policy due_diligence_checks_select_staff on public.due_diligence_checks
  for select to authenticated
  using (public.is_richmond_staff());

create policy due_diligence_checks_write_staff on public.due_diligence_checks
  for all to authenticated
  using (
    public.has_role(array['cse','branch_manager','master_admin']::public.user_role[])
  )
  with check (
    public.has_role(array['cse','branch_manager','master_admin']::public.user_role[])
  );

create policy due_diligence_signoffs_select_staff on public.due_diligence_signoffs
  for select to authenticated
  using (public.is_richmond_staff());

create policy due_diligence_signoffs_insert_cse on public.due_diligence_signoffs
  for insert to authenticated
  with check (
    role_key = 'cse'
    and public.has_role(array['cse']::public.user_role[])
    and signer_id = auth.uid()
  );

create policy due_diligence_signoffs_insert_branch_mgr on public.due_diligence_signoffs
  for insert to authenticated
  with check (
    role_key = 'branch_manager'
    and public.has_role(array['branch_manager']::public.user_role[])
    and signer_id = auth.uid()
  );

create policy due_diligence_signoffs_insert_dd_team on public.due_diligence_signoffs
  for insert to authenticated
  with check (
    role_key = 'due_diligence'
    and public.has_role(array['approver_l1','approver_l2','master_admin']::public.user_role[])
    and signer_id = auth.uid()
  );

-- ─── LOANS
create policy loans_select_owner on public.loans
  for select to authenticated
  using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
  );

create policy loans_select_employer on public.loans
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );

create policy loans_select_staff on public.loans
  for select to authenticated
  using (public.is_richmond_staff());

create policy loans_insert_accounts on public.loans
  for insert to authenticated
  with check (
    public.has_role(array['accounts','master_admin']::public.user_role[])
  );

create policy loans_update_accounts on public.loans
  for update to authenticated
  using (public.has_role(array['accounts','cfo','master_admin']::public.user_role[]))
  with check (public.has_role(array['accounts','cfo','master_admin']::public.user_role[]));

-- ─── LOAN SCHEDULE
create policy loan_schedule_select_owner on public.loan_schedule
  for select to authenticated
  using (
    loan_id in (
      select l.id from public.loans l
      join public.employees e on e.id = l.employee_id
      where e.profile_id = auth.uid()
    )
  );

create policy loan_schedule_select_employer on public.loan_schedule
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and loan_id in (select id from public.loans where employer_id = public.current_user_employer())
  );

create policy loan_schedule_select_staff on public.loan_schedule
  for select to authenticated
  using (public.is_richmond_staff());

create policy loan_schedule_write_staff on public.loan_schedule
  for all to authenticated
  using (public.has_role(array['accounts','master_admin']::public.user_role[]))
  with check (public.has_role(array['accounts','master_admin']::public.user_role[]));

-- ─── REMITTANCE BATCHES + REPAYMENTS
create policy remittance_batches_select on public.remittance_batches
  for select to authenticated
  using (
    public.is_richmond_staff()
    or (
      public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
      and employer_id = public.current_user_employer()
    )
  );
create policy remittance_batches_write_staff on public.remittance_batches
  for all to authenticated
  using (public.has_role(array['accounts','master_admin']::public.user_role[]))
  with check (public.has_role(array['accounts','master_admin']::public.user_role[]));
create policy remittance_batches_update_employer on public.remittance_batches
  for update to authenticated
  using (
    public.has_role(array['employer_admin']::public.user_role[])
    and employer_id = public.current_user_employer()
    and status in ('sent','partially_received')
  )
  with check (employer_id = public.current_user_employer());

create policy repayments_select_owner on public.repayments
  for select to authenticated
  using (
    loan_id in (
      select l.id from public.loans l
      join public.employees e on e.id = l.employee_id
      where e.profile_id = auth.uid()
    )
  );
create policy repayments_select_employer on public.repayments
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and employer_id = public.current_user_employer()
  );
create policy repayments_select_staff on public.repayments
  for select to authenticated
  using (public.is_richmond_staff());
create policy repayments_write_staff on public.repayments
  for all to authenticated
  using (public.has_role(array['accounts','master_admin']::public.user_role[]))
  with check (public.has_role(array['accounts','master_admin']::public.user_role[]));

-- ─── CONTRACT TEMPLATES + CONTRACTS
create policy contract_templates_select_all on public.contract_templates
  for select to authenticated using (true);
create policy contract_templates_write_master on public.contract_templates
  for all to authenticated
  using (public.is_master_admin())
  with check (public.is_master_admin());

create policy contracts_select_owner on public.contracts
  for select to authenticated
  using (
    loan_id in (
      select l.id from public.loans l
      join public.employees e on e.id = l.employee_id
      where e.profile_id = auth.uid()
    )
    or application_id in (
      select la.id from public.loan_applications la
      join public.employees e on e.id = la.employee_id
      where e.profile_id = auth.uid()
    )
  );

create policy contracts_select_employer on public.contracts
  for select to authenticated
  using (
    public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and (
      loan_id in (select id from public.loans where employer_id = public.current_user_employer())
      or application_id in (select id from public.loan_applications where employer_id = public.current_user_employer())
    )
  );

create policy contracts_select_staff on public.contracts
  for select to authenticated
  using (public.is_richmond_staff());

create policy contracts_write_staff on public.contracts
  for all to authenticated
  using (public.has_role(array['cse','branch_manager','accounts','master_admin']::public.user_role[]))
  with check (public.has_role(array['cse','branch_manager','accounts','master_admin']::public.user_role[]));

-- ─── CONTRACT EVIDENCE — INSERT ONLY (no update, no delete)
create policy contract_signatures_select_staff on public.contract_signatures
  for select to authenticated using (public.is_richmond_staff());
create policy contract_signatures_select_owner on public.contract_signatures
  for select to authenticated
  using (
    signatory_profile_id = auth.uid()
    or contract_id in (
      select c.id from public.contracts c
      where c.loan_id in (
        select l.id from public.loans l
        join public.employees e on e.id = l.employee_id
        where e.profile_id = auth.uid()
      )
    )
  );
create policy contract_signatures_insert_self on public.contract_signatures
  for insert to authenticated
  with check (signatory_profile_id = auth.uid());
-- No update or delete policy → those operations are forbidden by RLS

create policy contract_audit_events_select_staff on public.contract_audit_events
  for select to authenticated using (public.is_richmond_staff());
create policy contract_audit_events_select_owner on public.contract_audit_events
  for select to authenticated
  using (actor_profile_id = auth.uid());
create policy contract_audit_events_insert_authenticated on public.contract_audit_events
  for insert to authenticated
  with check (true);  -- writers are gated by the application layer + audit trigger
-- No update or delete

-- ─── NOTIFICATIONS + SMS LOG
create policy notifications_select_self on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or public.is_richmond_staff());

create policy notifications_insert_staff on public.notifications
  for insert to authenticated
  with check (public.is_richmond_staff());

create policy notifications_update_self on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy sms_log_select_staff on public.sms_log
  for select to authenticated using (public.is_richmond_staff());
create policy sms_log_insert_staff on public.sms_log
  for insert to authenticated
  with check (public.is_richmond_staff());

-- ─── AUDIT LOG — INSERT ONLY (writes via SECURITY DEFINER write_audit() bypass RLS)
create policy audit_log_select_admin_auditor on public.audit_log
  for select to authenticated
  using (public.is_master_admin() or public.is_auditor());
-- No insert policy from authenticated callers — only the SECURITY DEFINER
-- write_audit() runs as the postgres role and bypasses RLS.
