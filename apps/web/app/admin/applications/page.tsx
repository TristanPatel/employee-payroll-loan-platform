import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { ApplicationStatusBadge } from './_components/status-badge';
import { formatZmw, formatLusakaDate } from '@eplp/shared';

export const dynamic = 'force-dynamic';

const QUEUE_FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'cse',        label: 'CSE review',  statuses: ['cse_review'] },
  { key: 'l1',         label: 'L1 pending',  statuses: ['l1_pending'] },
  { key: 'l2',         label: 'L2 pending',  statuses: ['l2_pending'] },
  { key: 'l3',         label: 'L3 pending',  statuses: ['l3_pending'] },
  { key: 'decided',    label: 'Decided',     statuses: ['approved', 'rejected'] },
  { key: 'all',        label: 'All',         statuses: [] },
];

export default async function ApplicationsListPage({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<React.ReactElement> {
  const queue = searchParams.q && QUEUE_FILTERS.find((f) => f.key === searchParams.q)
    ? QUEUE_FILTERS.find((f) => f.key === searchParams.q)!
    : QUEUE_FILTERS[0]!;

  const supabase = await createSupabaseServer();
  let query = supabase
    .from('loan_applications')
    .select(`id, application_no, status, tier, requested_amount_ngwee,
             requested_tenure_months, submitted_at, created_at,
             employees ( profiles ( full_name ) ),
             employers ( legal_name )`)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (queue.statuses.length > 0) {
    query = query.in('status', queue.statuses as never);
  }

  const { data: apps } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Applications</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Each queue lists the next decision required from staff. Maker-checker is enforced
          at every approval tier.
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-md border border-ink-muted/10 bg-white p-1 text-xs">
        {QUEUE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/applications${f.key === 'cse' ? '' : `?q=${f.key}`}`}
            className={
              queue.key === f.key
                ? 'rounded bg-richmond-primary px-3 py-1.5 font-medium text-white'
                : 'rounded px-3 py-1.5 text-ink-muted hover:bg-surface-base'
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent className="p-0">
          {apps && apps.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Application</th>
                  <th className="px-6 py-3 font-medium">Borrower</th>
                  <th className="px-6 py-3 font-medium">Employer</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium">Tier</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const borrower =
                    (a.employees as { profiles?: { full_name?: string } } | null)?.profiles?.full_name ??
                    '—';
                  const employer =
                    (a.employers as { legal_name?: string } | null)?.legal_name ?? '—';
                  return (
                    <tr key={a.id} className="border-b border-ink-muted/5 last:border-0">
                      <td className="px-6 py-3 font-medium text-ink-base">
                        <Link
                          href={`/admin/applications/${a.id}`}
                          className="hover:text-richmond-primary"
                        >
                          {a.application_no ?? a.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-ink-muted">{borrower}</td>
                      <td className="px-6 py-3 text-ink-muted">{employer}</td>
                      <td className="px-6 py-3 text-right text-ink-base">
                        {formatZmw(Number(a.requested_amount_ngwee))}
                      </td>
                      <td className="px-6 py-3 text-xs uppercase text-ink-muted">
                        {(a.tier ?? '—').toString()}
                      </td>
                      <td className="px-6 py-3">
                        <ApplicationStatusBadge status={a.status} />
                      </td>
                      <td className="px-6 py-3 text-xs text-ink-muted">
                        {a.submitted_at ? formatLusakaDate(a.submitted_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No applications in this queue.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
