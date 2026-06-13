'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';
import type { Enums } from '@eplp/shared';

export interface FormState {
  error?: string;
  ok?: boolean;
}

type Role = Enums<'user_role'>;

const ASSIGNABLE_ROLES: ReadonlyArray<Role> = [
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
  'employee',
];

const EMPLOYER_ROLES: ReadonlyArray<Role> = ['employer_admin', 'employer_signatory'];

export async function updateStaffAccess(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const caller = await requireMasterAdmin();

  const profileId = String(formData.get('profile_id') ?? '');
  const role = String(formData.get('role') ?? '') as Role;
  const branchIdRaw = String(formData.get('branch_id') ?? '');
  const branchId = branchIdRaw === '' ? null : branchIdRaw;
  const employerIdRaw = String(formData.get('employer_id') ?? '');
  const employerId = employerIdRaw === '' ? null : employerIdRaw;
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  const phone = phoneRaw === '' ? null : phoneRaw;
  const isActive = formData.get('is_active') === 'on';

  if (!profileId) return { error: 'Missing profile id.' };
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: 'Invalid role.' };
  if (EMPLOYER_ROLES.includes(role) && !employerId) {
    return { error: 'Employer roles must be linked to an employer.' };
  }
  // Every staff-side role receives SMS alerts (attestation, approvals,
  // escalations). A missing phone silently drops those, so require one.
  // Borrowers (employee) set their own phone in the apply wizard.
  if (role !== 'employee' && !phone) {
    return { error: 'A mobile number is required for staff — they receive SMS alerts.' };
  }
  // Light E.164 / Zambian sanity check; the worker normalises the exact format.
  if (phone && !/^\+?[0-9][0-9\s-]{6,15}$/.test(phone)) {
    return { error: 'Enter a valid mobile number (e.g. 0971234567 or +260971234567).' };
  }

  // Lockout guard: a master_admin cannot demote or deactivate themselves —
  // another master_admin must do it, so the platform always retains at
  // least one active master_admin.
  if (profileId === caller.id && (role !== 'master_admin' || !isActive)) {
    return { error: 'You cannot demote or deactivate your own master_admin account.' };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      role,
      branch_id: branchId,
      employer_id: EMPLOYER_ROLES.includes(role) ? employerId : null,
      phone,
      is_active: isActive,
    })
    .eq('id', profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin/staff');
  return { ok: true };
}

export async function deleteUser(profileId: string): Promise<FormState> {
  await requireMasterAdmin();
  if (!profileId) return { error: 'Missing profile id.' };
  const supabase = await createSupabaseServer();
  // admin_delete_user enforces master_admin, self-delete and last-master
  // guards in the database, and soft-deletes the profile + bans the auth user.
  const { error } = await supabase.rpc('admin_delete_user', { p_profile_id: profileId });
  if (error) return { error: error.message };
  revalidatePath('/admin/staff');
  return { ok: true };
}

