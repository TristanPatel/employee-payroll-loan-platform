import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { formatZmw, formatLusakaDate } from '@eplp/shared';
import { RecomputeArrearsButton } from './_components/recompute-arrears-button';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'pending_disbursement', label: 'Pending disbursement' },
  { key: 'active', label: 'Active' },
  { key: 'in_arrears', label: 'In arrears' },
  { key: 'settled', label: 'Settled' },
  { key: 'all', label: 'All' },
] as const;

export default async function AdminLoansPage({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<React.ReactElement> {
  const filter = FILTERS.find((f) => f.key === searchParams.q) ?? FILTERS[0];
  const supabase = await createSupabaseServer();
  let q = supabase
    .from('loans')
    .select(`id, loan_no, status, principal_ngwee, monthly_installment_ngwee,
             current_outstanding_ngwee, start_date, end_date,
             employees ( profiles ( full_name ) ),
             employers ( legal_name )`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter.key !== 'all') q = q.eq('status', filter.key as never);
  const { data: loans } = await q;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Loans</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Loans are created automatically when an application is approved. Accounts records
            the disbursement; afterwards the loan moves to <code className="text-xs">active</code>.
          </p>
        </div>
        <RecomputeArrearsButton />
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-md border border-ink-muted/10 bg-white p-1 text-xs">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/loans${f.key === 'pending_disbursement' ? '' : `?q=${f.key}`}`}
            className={
              filter.key === f.key
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
          {loans && loans.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Loan #</th>
                  <th className="px-6 py-3 font-medium">Borrower</th>
                  <th className="px-6 py-3 font-medium">Employer</th>
                  <th className="px-6 py-3 font-medium text-right">Principal</th>
                  <th className="px-6 py-3 font-medium text-right">Outstanding</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Start</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const borrower =
                    (l.employees as { profiles?: { full_name?: string } } | null)?.profiles?.full_name ?? '—';
                  const employer =
                    (l.employers as { legal_name?: string } | null)?.legal_name ?? '—';
                  return (
                    <tr key={l.id} className="border-b border-ink-muted/5 last:border-0">
                      <td className="px-6 py-3 font-medium text-ink-base">
                        <Link href={`/admin/loans/${l.id}`} className="hover:text-richmond-primary">
                          {l.loan_no ?? l.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-ink-muted">{borrower}</td>
                      <td className="px-6 py-3 text-ink-muted">{employer}</td>
                      <td className="px-6 py-3 text-right text-ink-base">
                        {formatZmw(Number(l.principal_ngwee))}
                      </td>
                      <td className="px-6 py-3 text-right text-ink-base">
                        {formatZmw(Number(l.current_outstanding_ngwee))}
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs">{l.status}</span>
                      </td>
                      <td className="px-6 py-3 text-xs text-ink-muted">
                        {formatLusakaDate(l.start_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No loans in this filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
