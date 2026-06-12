-- The /apply/[slug] landing page already exposes the same active-employer
-- columns to unauthenticated visitors. After signup, the same borrower hits
-- /portal/apply, where the employer-select dropdown queries the same table —
-- but now under the `authenticated` role, where only `employers_select_staff_or_own`
-- applies. That policy requires id = current_user_employer(), and a fresh
-- borrower's profiles.employer_id is NULL until they're linked via an employees
-- row. Result: empty dropdown, wizard blocked on the Employment step.
--
-- Widen the public-apply policy to `authenticated` so logged-in employees
-- can list the same active employers they could see while logged out.

drop policy if exists employers_select_public_apply on public.employers;

create policy employers_select_public_apply on public.employers
  for select to anon, authenticated
  using (status = 'active' and deleted_at is null);
