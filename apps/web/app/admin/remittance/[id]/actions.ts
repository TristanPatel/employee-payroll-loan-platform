'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';
import { kwachaToNgwee } from '@eplp/shared';

export interface CaptureResult { error?: string; ok?: boolean }

export async function recordRepayment(input: {
  loanId: string;
  scheduleId: string;
  amountKwacha: number;
  paymentDate: string; // YYYY-MM-DD
  bankReference: string;
  remittanceBatchId: string;
}): Promise<CaptureResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('record_repayment', {
    p_loan_id: input.loanId,
    p_schedule_id: input.scheduleId,
    p_amount_ngwee: kwachaToNgwee(input.amountKwacha),
    p_payment_date: input.paymentDate,
    p_bank_reference: input.bankReference,
    p_remittance_batch_id: input.remittanceBatchId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/remittance/${input.remittanceBatchId}`);
  revalidatePath(`/admin/loans/${input.loanId}`);
  return { ok: true };
}

export async function recomputeArrears(): Promise<CaptureResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('recompute_arrears');
  if (error) return { error: error.message };
  revalidatePath('/admin/loans');
  return { ok: true };
}
