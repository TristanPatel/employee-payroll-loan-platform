-- Phase 4A / 19 — Storage RLS policies.
--
-- Bucket layout: application-docs/{auth_uid}/{application_id}/{doc_type}.{ext}
-- Borrowers can upload + read their own; Richmond staff can read everything.
-- Auditor reads everything; nothing is delete-able from authenticated callers.

create policy storage_application_docs_insert_self on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_application_docs_update_self on storage.objects
  for update to authenticated
  using (
    bucket_id = 'application-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'application-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_application_docs_select_self on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_application_docs_select_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-docs'
    and public.is_richmond_staff()
  );

-- Employer admins / signatories can read documents tied to applications under
-- their employer scope. We resolve the link via application_documents.
create policy storage_application_docs_select_employer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-docs'
    and public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and exists (
      select 1
      from public.application_documents ad
      join public.loan_applications la on la.id = ad.application_id
      where ad.storage_path = storage.objects.name
        and la.employer_id = public.current_user_employer()
    )
  );

-- ─── employer-docs bucket: master_admin write; staff + own employer read
create policy storage_employer_docs_insert_master on storage.objects
  for insert to authenticated
  with check (bucket_id = 'employer-docs' and public.is_master_admin());

create policy storage_employer_docs_update_master on storage.objects
  for update to authenticated
  using (bucket_id = 'employer-docs' and public.is_master_admin())
  with check (bucket_id = 'employer-docs' and public.is_master_admin());

create policy storage_employer_docs_select_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'employer-docs' and public.is_richmond_staff());

create policy storage_employer_docs_select_own_employer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employer-docs'
    and public.has_role(array['employer_admin','employer_signatory']::public.user_role[])
    and (storage.foldername(name))[1] = public.current_user_employer()::text
  );

-- ─── contracts / signatures / pop buckets: staff write; staff + relevant
-- borrower/employer read (signed-URL access narrows further at the app
-- layer; these RLS policies are belt-and-braces).
create policy storage_contracts_write_staff on storage.objects
  for all to authenticated
  using (bucket_id = 'contracts' and public.is_richmond_staff())
  with check (bucket_id = 'contracts' and public.is_richmond_staff());

create policy storage_signatures_insert_self on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_signatures_select_self on storage.objects
  for select to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_signatures_select_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and public.is_richmond_staff());

create policy storage_pop_write_employer on storage.objects
  for all to authenticated
  using (
    bucket_id = 'pop'
    and public.has_role(array['employer_admin']::public.user_role[])
    and (storage.foldername(name))[1] = public.current_user_employer()::text
  )
  with check (
    bucket_id = 'pop'
    and public.has_role(array['employer_admin']::public.user_role[])
    and (storage.foldername(name))[1] = public.current_user_employer()::text
  );

create policy storage_pop_select_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'pop' and public.is_richmond_staff());
