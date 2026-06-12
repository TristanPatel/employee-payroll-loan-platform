import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { ContractRow } from './contract-row';
import { formatLusakaDate } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function AdminContractsPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`id, contract_type, status, created_at, fully_signed_at,
             document_storage_path, document_sha256, fully_signed_pdf_sha256,
             required_signatories,
             loan_applications ( application_no, employers ( legal_name ) )`)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Contracts</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fully-signed contracts are sealed via the &ldquo;Seal&rdquo; action below. PAdES Baseline-T
          when the signing certificate is configured, soft-seal otherwise.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {contracts && contracts.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Application</th>
                  <th className="px-6 py-3 font-medium">Employer</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const app = c.loan_applications as
                    | { application_no?: string; employers?: { legal_name?: string } }
                    | null;
                  return (
                    <tr key={c.id} className="border-b border-ink-muted/5 last:border-0 align-top">
                      <td className="px-6 py-3 font-medium text-ink-base">{c.contract_type}</td>
                      <td className="px-6 py-3 text-ink-muted">
                        <Link
                          href={`/verify/${c.id}`}
                          className="font-mono text-xs hover:text-richmond-primary"
                        >
                          {app?.application_no ?? c.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-ink-muted">{app?.employers?.legal_name ?? '—'}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-6 py-3 text-xs text-ink-muted">{formatLusakaDate(c.created_at)}</td>
                      <td className="px-6 py-3 text-right">
                        <ContractRow
                          contractId={c.id}
                          status={c.status}
                          hasDocument={Boolean(c.document_storage_path)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No contracts yet. Submit an application as an employee to create one.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const map: Record<string, string> = {
    draft: 'bg-ink-muted/10 text-ink-muted',
    sent: 'bg-status-info/10 text-status-info',
    partially_signed: 'bg-status-warning/10 text-status-warning',
    fully_signed: 'bg-status-success/10 text-status-success',
    sealed: 'bg-richmond-primary/10 text-richmond-primary',
    voided: 'bg-status-danger/10 text-status-danger',
    expired: 'bg-ink-muted/10 text-ink-muted',
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
        map[status] ?? 'bg-ink-muted/10 text-ink-muted'
      }`}
    >
      {status}
    </span>
  );
}
