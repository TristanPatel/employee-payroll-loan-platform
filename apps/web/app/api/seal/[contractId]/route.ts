import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { buildFinalPdf, type SignatureForStamp } from '@/lib/seal/build-final-pdf';
import { applyPades } from '@/lib/seal/pades';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { contractId: string } },
): Promise<NextResponse> {
  // Master admin, CFO, accounts, or branch_manager may seal.
  await requireRole(['master_admin', 'cfo', 'accounts', 'branch_manager']);

  const supabase = await createSupabaseServer();

  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select(`id, status, document_storage_path, document_sha256,
             required_signatories, template_id, template_version, contract_type,
             application_id, loan_id,
             contract_templates ( template_key ),
             loan_applications ( application_no ),
             loans ( loan_no )`)
    .eq('id', params.contractId)
    .maybeSingle();
  if (contractErr || !contract) {
    return NextResponse.json({ error: contractErr?.message ?? 'contract not found' }, { status: 404 });
  }

  if (contract.status !== 'fully_signed') {
    return NextResponse.json(
      { error: `contract status is ${contract.status}; must be fully_signed` },
      { status: 409 },
    );
  }
  if (!contract.document_storage_path) {
    return NextResponse.json(
      { error: 'contract has no document_storage_path; regenerate Part A first' },
      { status: 409 },
    );
  }

  // Fetch signatures + audit events for the certificate of completion
  const [{ data: sigs }, { data: events }] = await Promise.all([
    supabase
      .from('contract_signatures')
      .select(
        `signatory_role, signatory_name_snapshot, signatory_nrc_snapshot,
         signed_at, signature_image_path, ip_address, user_agent,
         authentication_method, envelope_sha256, document_sha256_at_signing`,
      )
      .eq('contract_id', contract.id)
      .order('signed_at', { ascending: true }),
    supabase
      .from('contract_audit_events')
      .select('event_type, occurred_at')
      .eq('contract_id', contract.id)
      .order('occurred_at', { ascending: true }),
  ]);

  // Download the original Part A PDF
  const { data: docBlob, error: dlErr } = await supabase.storage
    .from('contracts')
    .download(contract.document_storage_path);
  if (dlErr || !docBlob) {
    return NextResponse.json({ error: dlErr?.message ?? 'document fetch failed' }, { status: 500 });
  }
  const originalBytes = new Uint8Array(await docBlob.arrayBuffer());

  // Fetch every signature image (signed URL → fetch bytes)
  const signatures: SignatureForStamp[] = [];
  for (const s of sigs ?? []) {
    let imageBytes: Uint8Array | null = null;
    if (s.signature_image_path) {
      const { data: sig } = await supabase.storage
        .from('signatures')
        .download(s.signature_image_path);
      if (sig) imageBytes = new Uint8Array(await sig.arrayBuffer());
    }
    signatures.push({
      role: s.signatory_role,
      name: s.signatory_name_snapshot,
      nrc: s.signatory_nrc_snapshot,
      signedAtIso: s.signed_at,
      imageBytes,
      ip: s.ip_address ? String(s.ip_address) : null,
      userAgent: s.user_agent,
      authenticationMethod: s.authentication_method,
      envelopeSha256: s.envelope_sha256,
      documentSha256AtSigning: s.document_sha256_at_signing,
    });
  }

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.richmond-afri.com';
  const verifyUrl = `${portalUrl}/verify/${contract.id}`;
  const signingCertUrl =
    process.env.NEXT_PUBLIC_SIGNING_CERT_URL ?? 'https://www.richmond-afri.com/legal/signing-cert';

  const templateKey =
    (contract.contract_templates as { template_key?: string } | null)?.template_key ?? 'unknown';

  const stampedPdf = await buildFinalPdf(originalBytes, {
    contractId: contract.id,
    contractType: contract.contract_type,
    templateKey,
    templateVersion: contract.template_version,
    applicationNo:
      (contract.loan_applications as { application_no?: string } | null)?.application_no ?? null,
    loanNo: (contract.loans as { loan_no?: string } | null)?.loan_no ?? null,
    verifyUrl,
    signingCertPublicUrl: signingCertUrl,
    signatures,
    auditEvents: events ?? [],
  });

  // Apply PAdES-B-T (or soft-seal if env not configured)
  const seal = await applyPades(stampedPdf);
  const finalBytes = seal.bytes;
  const finalSha = createHash('sha256').update(finalBytes).digest('hex');
  const finalPath = `${contract.id}/sealed-v1.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('contracts')
    .upload(finalPath, finalBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from('contracts')
    .update({
      status: 'sealed',
      fully_signed_pdf_path: finalPath,
      fully_signed_pdf_sha256: finalSha,
      certificate_of_completion_path: finalPath, // appended inline in this build
    })
    .eq('id', contract.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Log the seal event in contract_audit_events
  await supabase.from('contract_audit_events').insert({
    contract_id: contract.id,
    event_type: 'sealed',
    payload: {
      mode: seal.mode,
      sealed_pdf_sha256: finalSha,
      tsa_timestamp_sec: seal.timestampSec ?? null,
      signer_common_name: seal.signerCommonName ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    mode: seal.mode,
    sealed_path: finalPath,
    sha256: finalSha,
    tsa_timestamp_sec: seal.timestampSec ?? null,
  });
}
