'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';

export interface ActionResult { error?: string; missed?: number }

export async function recomputeArrears(): Promise<ActionResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('recompute_arrears');
  if (error) return { error: error.message };
  revalidatePath('/admin/loans');
  return { missed: (data as number) ?? 0 };
}

export async function closeLoan(input: {
  loanId: string;
  reason: string;
  forceWriteOff: boolean;
}): Promise<{ error?: string; ok?: boolean }> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('close_loan', {
    p_loan_id: input.loanId,
    p_closure_reason: input.reason,
    p_force_write_off: input.forceWriteOff,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/loans/${input.loanId}`);
  revalidatePath('/admin/loans');
  return { ok: true };
}
