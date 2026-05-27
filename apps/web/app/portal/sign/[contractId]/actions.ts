'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@eplp/shared';

export interface SealResult {
  error?: string;
  ok?: boolean;
  signatureId?: string;
}

export interface SealInput {
  contractId: string;
  signatoryRole: Enums<'contract_signatory_role'>;
  consentText: string;
  typedName: string;
  signatureImageBase64: string; // data:image/png;base64,…
  drawnPoints: { x: number; y: number; t: number }[];
  nrcCheckPassed: boolean;
  authenticationEvidence: Record<string, unknown>;
  deviceFingerprint?: string | null;
  geolocation?: { lat: number; lon: number; accuracy?: number } | null;
}

export async function sealEnvelope(input: SealInput): Promise<SealResult> {
  const profile = await requireRole([
    'employee',
    'master_admin',
    'branch_manager',
    'cse',
    'cfo',
    'employer_signatory',
  ]);
  const supabase = await createSupabaseServer();
  const h = headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null;
  const userAgent = h.get('user-agent');

  // 1. Upload the signature PNG to the signatures bucket
  let imagePath: string | null = null;
  if (input.signatureImageBase64.startsWith('data:image/')) {
    const [, base64] = input.signatureImageBase64.split(',');
    if (base64) {
      const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${profile.id}/${input.contractId}-${input.signatoryRole}.png`;
      const { error } = await supabase.storage.from('signatures').upload(path, buf, {
        contentType: 'image/png',
        upsert: true,
      });
      if (error) return { error: `Signature upload failed: ${error.message}` };
      imagePath = path;
    }
  }

  // 2. Call the sign_contract RPC — atomic insert of audit events + signature.
  // The PG function accepts nulls for optional parameters; the generated TS
  // types insist on non-null strings/jsonb so we cast at the call boundary.
  // The RPC validates everything server-side via SECURITY DEFINER logic.
  const rpcArgs = {
    p_contract_id: input.contractId,
    p_signatory_role: input.signatoryRole,
    p_consent_text: input.consentText,
    p_signature_typed_name: input.typedName,
    p_signature_image_path: imagePath,
    p_signature_drawn_points: input.drawnPoints,
    p_authentication_method: 'session',
    p_authentication_evidence: input.authenticationEvidence,
    p_nrc_knowledge_check_passed: input.nrcCheckPassed,
    p_ip: ip,
    p_user_agent: userAgent,
    p_device_fingerprint: input.deviceFingerprint ?? null,
    p_geolocation: input.geolocation ?? null,
  } as unknown as Parameters<typeof supabase.rpc<'sign_contract'>>[1];
  const { data, error } = await supabase.rpc('sign_contract', rpcArgs);

  if (error) return { error: error.message };
  revalidatePath(`/portal/sign/${input.contractId}`);
  revalidatePath(`/verify/${input.contractId}`);
  return { ok: true, signatureId: data as unknown as string };
}
