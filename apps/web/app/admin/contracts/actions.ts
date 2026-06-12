'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

export interface RegenerateResult {
  ok?: boolean;
  error?: string;
  storagePath?: string;
}

/**
 * Re-runs the generate-part-a Edge Function for a contract whose
 * `document_storage_path` is missing — e.g. when the apply submission's
 * best-effort PDF generation failed silently. Writes the resulting storage
 * path + SHA-256 back onto the contract row so it can be sealed.
 */
export async function regeneratePartA(contractId: string): Promise<RegenerateResult> {
  await requireRole(['master_admin', 'cse', 'branch_manager', 'accounts']);

  const supabase = await createSupabaseServer();

  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('id, application_id, contract_type, status')
    .eq('id', contractId)
    .maybeSingle();
  if (cErr || !contract) return { error: cErr?.message ?? 'contract not found' };
  if (!contract.application_id) return { error: 'contract has no application_id' };
  if (contract.contract_type !== 'loan_agreement') {
    return { error: `unsupported contract_type ${contract.contract_type}` };
  }
  if (['sealed', 'voided', 'expired'].includes(contract.status)) {
    return { error: `contract is ${contract.status}; regeneration not allowed` };
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) return { error: 'no active session' };

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-part-a`;
  let payload: { storage_path?: string; sha256?: string; error?: string };
  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ application_id: contract.application_id }),
    });
    payload = (await res.json()) as typeof payload;
    if (!res.ok) return { error: payload.error ?? `edge function ${res.status}` };
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!payload.storage_path) return { error: 'edge function returned no storage_path' };

  const { error: uErr } = await supabase
    .from('contracts')
    .update({
      document_storage_path: payload.storage_path,
      document_sha256: payload.sha256 ?? null,
    })
    .eq('id', contractId);
  if (uErr) return { error: uErr.message };

  revalidatePath('/admin/contracts');
  return { ok: true, storagePath: payload.storage_path };
}
