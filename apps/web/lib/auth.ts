// Role-gated helpers used by RSC layouts/pages. Always returns the profile
// row or redirects. Inactive profiles are treated as unauthenticated.

import { redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
import type { Tables, Enums } from '@eplp/shared';

export type Role = Enums<'user_role'>;
export type Profile = Tables<'profiles'>;

const RICHMOND_STAFF: ReadonlyArray<Role> = [
  'master_admin',
  'branch_manager',
  'cse',
  'approver_l1',
  'approver_l2',
  'accounts',
  'cfo',
  'auditor',
];

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userRes.user.id)
    .maybeSingle();
  if (error || !profile || !profile.is_active || profile.deleted_at) return null;
  return profile as Profile;
}

export async function requireRole(allowed: ReadonlyArray<Role>): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/sign-in?error=Please%20sign%20in');
  }
  if (!allowed.includes(profile.role)) {
    redirect('/sign-in?error=Insufficient%20permissions');
  }
  return profile;
}

export async function requireMasterAdmin(): Promise<Profile> {
  return requireRole(['master_admin']);
}

export async function requireRichmondStaff(): Promise<Profile> {
  return requireRole(RICHMOND_STAFF);
}
