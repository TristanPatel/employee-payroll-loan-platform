-- ops/01-bootstrap-master-admin.sql
--
-- Run this in the Supabase SQL editor AFTER you've signed up via the
-- portal with your master-admin email address. Sign up first via
-- https://portal.richmond-afri.com/sign-in so the row in auth.users +
-- the corresponding profiles row exist.

-- 1. Confirm the user exists (paste your email)
select au.id, au.email, p.role, p.full_name
  from auth.users au
  left join public.profiles p on p.id = au.id
 where au.email = 'tristanpatel@yahoo.co.uk';

-- 2. Elevate to master_admin
update public.profiles
   set role = 'master_admin', is_active = true
 where id = (select id from auth.users where email = 'tristanpatel@yahoo.co.uk');

-- 3. Verify
select id, role, is_active, full_name
  from public.profiles
 where role = 'master_admin';
