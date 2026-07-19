
-- Phase 6 / 40 — Tighten anon EXECUTE on two SECURITY DEFINER functions.
-- has_role: re-assert authenticated + service_role grants before revoking
-- PUBLIC so authenticated never loses access.
grant  execute on function public.has_role(public.user_role[]) to authenticated, service_role;
revoke execute on function public.has_role(public.user_role[]) from anon, public;

-- app_request_employer_attestation: trigger function; strip EXECUTE from every
-- client role, keep service_role. Trigger continues to fire regardless.
revoke execute on function public.app_request_employer_attestation() from public, anon, authenticated;
grant  execute on function public.app_request_employer_attestation() to service_role;
