'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';

export interface ActionResult { error?: string; ok?: boolean }

export async function recordDisbursement(input: {
  loanId: string;
  method: 'bank_transfer' | 'mobile_money';
  reference: string;
  authorisedById: string;
}): Promise<ActionResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('record_disbursement', {
    p_loan_id: input.loanId,
    p_method: input.method,
    p_reference: input.reference,
    p_authorised_by: input.authorisedById,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/loans/${input.loanId}`);
  revalidatePath('/admin/loans');
  return { ok: true };
}
