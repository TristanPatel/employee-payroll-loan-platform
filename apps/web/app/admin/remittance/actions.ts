'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';

export interface BatchResult { error?: string; batchId?: string }

export async function generateBatch(input: {
  employerId: string;
  year: number;
  month: number;
}): Promise<BatchResult> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('generate_remittance_batch', {
    p_employer_id: input.employerId,
    p_year: input.year,
    p_month: input.month,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/remittance');
  if (data) redirect(`/admin/remittance/${data as string}`);
  return { batchId: data as string };
}

export async function markSent(batchId: string): Promise<{ error?: string }> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('mark_remittance_sent', { p_batch_id: batchId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/remittance/${batchId}`);
  return {};
}

export async function markReceived(input: {
  batchId: string;
  receivedNgwee: number;
  bankRef: string;
}): Promise<{ error?: string }> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('mark_remittance_received', {
    p_batch_id: input.batchId,
    p_received_amount_ngwee: input.receivedNgwee,
    p_bank_ref: input.bankRef,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/remittance/${input.batchId}`);
  return {};
}
