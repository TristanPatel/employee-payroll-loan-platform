'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function setDueDiligenceState(input: {
  applicationId: string;
  itemKey: string;
  state: 'pending' | 'pass' | 'fail' | 'na';
  note?: string | null;
}): Promise<ActionResult> {
  const profile = await requireRichmondStaff();
  if (!(['cse', 'branch_manager', 'master_admin'] as const).includes(profile.role as never)) {
    return { error: `role ${profile.role} cannot edit due-diligence checks` };
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('due_diligence_checks')
    .update({
      state: input.state,
      note: input.note ?? null,
      checked_by: profile.id,
      checked_at: new Date().toISOString(),
    })
    .eq('application_id', input.applicationId)
    .eq('item_key', input.itemKey);
  if (error) return { error: error.message };
  revalidatePath(`/admin/applications/${input.applicationId}`);
  return { ok: true };
}

export async function signoffDueDiligence(input: {
  applicationId: string;
  roleKey: 'cse' | 'branch_manager' | 'dd_team';
}): Promise<ActionResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('record_due_diligence_signoff', {
    p_application_id: input.applicationId,
    p_role_key: input.roleKey,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/applications/${input.applicationId}`);
  revalidatePath('/admin/applications');
  return { ok: true };
}

export async function advanceToCseReview(applicationId: string): Promise<ActionResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('advance_to_cse_review', {
    p_application_id: applicationId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath('/admin/applications');
  return { ok: true };
}

export async function recordApproval(input: {
  applicationId: string;
  tier: 'l1' | 'l2' | 'l3';
  decision: 'approve' | 'reject' | 'request_info';
  notes?: string | null;
}): Promise<ActionResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('record_approval', {
    p_application_id: input.applicationId,
    p_tier: input.tier,
    p_decision: input.decision,
    p_notes: input.notes ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/applications/${input.applicationId}`);
  revalidatePath('/admin/applications');
  return { ok: true };
}
