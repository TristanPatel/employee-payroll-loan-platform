'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

export interface AttestResult {
  ok?: boolean;
  error?: string;
}

export async function recordAttestation(
  applicationId: string,
  decision: 'confirmed' | 'declined',
  reason?: string,
): Promise<AttestResult> {
  await requireRole(['employer_admin', 'employer_signatory']);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('record_employer_attestation', {
    p_application_id: applicationId,
    p_decision: decision,
    p_reason: reason ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/employer');
  return { ok: true };
}
