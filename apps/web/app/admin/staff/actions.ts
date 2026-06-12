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

export async function updateStaffAccess(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const caller = await requireMasterAdmin();

  const profileId = String(formData.get('profile_id') ?? '');
  const role = String(formData.get('role') ?? '') as Role;
  const branchIdRaw = String(formData.get('branch_id') ?? '');
  const branchId = branchIdRaw === '' ? null : branchIdRaw;
  const isActive = formData.get('is_active') === 'on';

  if (!profileId) return { error: 'Missing profile id.' };
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: 'Invalid role.' };

  // Lockout guard: a master_admin cannot demote or deactivate themselves —
  // another master_admin must do it, so the platform always retains at
  // least one active master_admin.
  if (profileId === caller.id && (role !== 'master_admin' || !isActive)) {
    return { error: 'You cannot demote or deactivate your own master_admin account.' };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ role, branch_id: branchId, is_active: isActive })
    .eq('id', profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin/staff');
  return { ok: true };
}
