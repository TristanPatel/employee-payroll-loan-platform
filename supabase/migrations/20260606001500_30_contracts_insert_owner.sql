-- The apply server action runs under the borrower's session and creates the
-- draft loan_agreement contract for them to sign. contracts had only a
-- staff-write policy, so that insert was silently denied by RLS and the
-- borrower ended up with a submitted application but no signable contract.
--
-- Allow a borrower to insert ONLY the loan_agreement contract for an
-- application they own that is still in 'submitted' status, with no loan_id
-- and a non-final status. Everything else (template choice, sealing, voiding,
-- other contract types) stays staff-only.

create policy contracts_insert_owner on public.contracts
  for insert to authenticated
  with check (
    contract_type = 'loan_agreement'
    and loan_id is null
    and status in ('draft', 'sent')
    and application_id in (
      select la.id
        from public.loan_applications la
        join public.employees e on e.id = la.employee_id
       where e.profile_id = auth.uid()
         and la.status = 'submitted'
    )
  );
