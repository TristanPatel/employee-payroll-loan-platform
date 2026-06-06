-- submitApplication picks a routing branch by reading public.branches
-- with the borrower's anon-key session. Until now only Richmond staff could
-- read branches, so the apply wizard errored "No active branch is configured"
-- on the final submit. Active-branch (id, code, name, status) is not
-- sensitive — let any authenticated user list active branches.

create policy branches_select_active_authenticated on public.branches
  for select to authenticated
  using (status = 'active' and deleted_at is null);
