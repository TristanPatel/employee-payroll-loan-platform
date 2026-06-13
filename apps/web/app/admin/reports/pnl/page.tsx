import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw } from '@eplp/shared';

export const dynamic = 'force-dynamic';

interface PnlRow {
  period: string;
  new_loans: number;
  principal_disbursed: number;
  interest_booked: number;
  fees_booked: number;
  income_booked: number;
  cash_collected: number;
  written_off: number;
}

/**
 * CFO portfolio P&L. Income recognised on an origination basis (flat-rate
 * interest + fees booked at disbursement); cash collected and write-offs
 * shown alongside. Weekly or monthly via ?g=week|month.
 */
export default async function PnlPage({
  searchParams,
}: {
  searchParams: { g?: string };
}): Promise<React.ReactElement> {
  await requireRole(['master_admin', 'cfo', 'auditor']);
  const granularity = searchParams.g === 'week' ? 'week' : 'month';
  const periods = granularity === 'week' ? 12 : 12;

  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc('cfo_pnl', {
    p_granularity: granularity,
    p_periods: periods,
  });
  const rows = ((data ?? []) as unknown as PnlRow[]).map((r) => ({
    ...r,
    new_loans: Number(r.new_loans),
    principal_disbursed: Number(r.principal_disbursed),
    interest_booked: Number(r.interest_booked),
    fees_booked: Number(r.fees_booked),
    income_booked: Number(r.income_booked),
    cash_collected: Number(r.cash_collected),
    written_off: Number(r.written_off),
  }));

  const totals = rows.reduce(
    (a, r) => ({
      new_loans: a.new_loans + r.new_loans,
      principal_disbursed: a.principal_disbursed + r.principal_disbursed,
      interest_booked: a.interest_booked + r.interest_booked,
      fees_booked: a.fees_booked + r.fees_booked,
      income_booked: a.income_booked + r.income_booked,
      cash_collected: a.cash_collected + r.cash_collected,
      written_off: a.written_off + r.written_off,
    }),
    {
      new_loans: 0,
      principal_disbursed: 0,
      interest_booked: 0,
      fees_booked: 0,
      income_booked: 0,
      cash_collected: 0,
      written_off: 0,
    },
  );
  const netIncome = totals.income_booked - totals.written_off;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Portfolio P&amp;L</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Income booked at origination (flat-rate interest + admin/insurance fees), with cash
            collected and write-offs alongside. Live from the loan book.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-ink-muted/15 text-xs">
          <Link
            href="/admin/reports/pnl?g=month"
            className={`px-3 py-1.5 ${granularity === 'month' ? 'bg-richmond-primary text-white' : 'text-ink-muted hover:bg-surface-muted'}`}
          >
            Monthly
          </Link>
          <Link
            href="/admin/reports/pnl?g=week"
            className={`px-3 py-1.5 ${granularity === 'week' ? 'bg-richmond-primary text-white' : 'text-ink-muted hover:bg-surface-muted'}`}
          >
            Weekly
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Income booked" value={formatZmw(totals.income_booked)} />
        <Kpi label="Cash collected" value={formatZmw(totals.cash_collected)} />
        <Kpi label="Write-offs" value={formatZmw(totals.written_off)} tone="danger" />
        <Kpi label="Net income" value={formatZmw(netIncome)} tone={netIncome >= 0 ? 'success' : 'danger'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{granularity === 'week' ? 'Last 12 weeks' : 'Last 12 months'}</CardTitle>
          <CardDescription>
            Interest + fees are booked when a loan disburses. Net income = income booked −
            write-offs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium text-right">New</th>
                  <th className="px-6 py-3 font-medium text-right">Disbursed</th>
                  <th className="px-6 py-3 font-medium text-right">Interest</th>
                  <th className="px-6 py-3 font-medium text-right">Fees</th>
                  <th className="px-6 py-3 font-medium text-right">Income</th>
                  <th className="px-6 py-3 font-medium text-right">Collected</th>
                  <th className="px-6 py-3 font-medium text-right">Write-offs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3 font-medium text-ink-base">{r.period}</td>
                    <td className="px-6 py-3 text-right text-ink-muted">{r.new_loans}</td>
                    <td className="px-6 py-3 text-right text-ink-muted">{formatZmw(r.principal_disbursed)}</td>
                    <td className="px-6 py-3 text-right text-ink-muted">{formatZmw(r.interest_booked)}</td>
                    <td className="px-6 py-3 text-right text-ink-muted">{formatZmw(r.fees_booked)}</td>
                    <td className="px-6 py-3 text-right font-medium text-ink-base">{formatZmw(r.income_booked)}</td>
                    <td className="px-6 py-3 text-right text-status-success">{formatZmw(r.cash_collected)}</td>
                    <td className="px-6 py-3 text-right text-status-danger">{formatZmw(r.written_off)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-muted/20 bg-surface-muted text-sm font-semibold">
                  <td className="px-6 py-3 text-ink-base">Total</td>
                  <td className="px-6 py-3 text-right">{totals.new_loans}</td>
                  <td className="px-6 py-3 text-right">{formatZmw(totals.principal_disbursed)}</td>
                  <td className="px-6 py-3 text-right">{formatZmw(totals.interest_booked)}</td>
                  <td className="px-6 py-3 text-right">{formatZmw(totals.fees_booked)}</td>
                  <td className="px-6 py-3 text-right">{formatZmw(totals.income_booked)}</td>
                  <td className="px-6 py-3 text-right text-status-success">{formatZmw(totals.cash_collected)}</td>
                  <td className="px-6 py-3 text-right text-status-danger">{formatZmw(totals.written_off)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-ink-muted">
        Origination-basis recognition suits a flat-rate book. For IFRS effective-interest
        accrual, export the loan book CSV from{' '}
        <Link href="/admin/reports" className="text-richmond-primary hover:underline">
          Reports
        </Link>{' '}
        and reconcile in your ledger.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}): React.ReactElement {
  return (
    <Card>
      <CardContent>
        <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : 'text-ink-base'
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
