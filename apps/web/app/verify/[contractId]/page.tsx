import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatLusakaDateTime } from '@eplp/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

// Public verifier — exposes ONLY: signatory names, roles, signed-at,
// document hash, envelope hash. NEVER NRC, phone, email, IP, or
// geolocation. See docs/legal/registered-office.md.

export default async function VerifyPage({
  params,
}: {
  params: { contractId: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: contract } = await supabase
    .from('contracts')
    .select(`id, contract_type, status, document_sha256,
             fully_signed_pdf_sha256, fully_signed_at, voided_at,
             required_signatories, created_at`)
    .eq('id', params.contractId)
    .maybeSingle();

  if (!contract) notFound();

  const { data: sigs } = await supabase
    .from('contract_signatures')
    .select('signatory_role, signatory_name_snapshot, signed_at, envelope_sha256')
    .eq('contract_id', contract.id)
    .order('signed_at', { ascending: true });

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-ink-muted/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-richmond-primary text-sm font-bold text-white">
              RF
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-base">Richmond Finance</div>
              <div className="text-xs text-ink-muted">Contract verification</div>
            </div>
          </div>
          <Link href="/" className="text-xs text-ink-muted hover:text-richmond-primary">
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Public verifier</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-base">{contract.contract_type}</h1>
          <p className="mt-1 font-mono text-xs text-ink-muted">contract id {contract.id}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              {contract.status === 'sealed' ? (
                <span>Cryptographically sealed.</span>
              ) : contract.status === 'fully_signed' ? (
                <span>All required signatories have signed.</span>
              ) : contract.status === 'voided' ? (
                <span>Voided.</span>
              ) : (
                <span>In progress.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Current status</dt>
              <dd className="text-right text-ink-base">{contract.status}</dd>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Required signatories</dt>
              <dd className="text-right text-ink-base">
                {(contract.required_signatories ?? []).join(', ')}
              </dd>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Created</dt>
              <dd className="text-right text-ink-base">
                {formatLusakaDateTime(contract.created_at)}
              </dd>
              {contract.fully_signed_at ? (
                <>
                  <dt className="text-xs uppercase tracking-wide text-ink-muted">Fully signed</dt>
                  <dd className="text-right text-ink-base">
                    {formatLusakaDateTime(contract.fully_signed_at)}
                  </dd>
                </>
              ) : null}
              {contract.voided_at ? (
                <>
                  <dt className="text-xs uppercase tracking-wide text-ink-muted">Voided</dt>
                  <dd className="text-right text-status-danger">
                    {formatLusakaDateTime(contract.voided_at)}
                  </dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hashes</CardTitle>
            <CardDescription>SHA-256 fingerprints of the document and envelope.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">Original document SHA-256</dt>
                <dd className="break-all font-mono text-[11px] text-ink-base">
                  {contract.document_sha256 ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">Final sealed PDF SHA-256</dt>
                <dd className="break-all font-mono text-[11px] text-ink-base">
                  {contract.fully_signed_pdf_sha256 ?? '(not yet sealed)'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signatories</CardTitle>
            <CardDescription>
              {(sigs?.length ?? 0)} of {(contract.required_signatories ?? []).length} required signatures recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sigs && sigs.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Signed at (CAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {sigs.map((s, i) => (
                    <tr key={i} className="border-t border-ink-muted/5">
                      <td className="py-2 font-medium text-ink-base">{s.signatory_role}</td>
                      <td className="py-2 text-ink-base">{s.signatory_name_snapshot}</td>
                      <td className="py-2 text-ink-muted">{formatLusakaDateTime(s.signed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-ink-muted">No signatures recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-ink-muted">
          This page exposes only the signatory roles, names, signed-at timestamps, and
          cryptographic hashes. NRCs, contact details, IP addresses, and geolocation are
          never displayed here.
        </p>
      </div>
    </main>
  );
}
