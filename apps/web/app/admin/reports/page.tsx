import Link from 'next/link';
import { Download } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatZmw } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function ReportsPage(): Promise<React.ReactElement> {
  await requireRole(['master_admin', 'cfo', 'auditor']);
  const supabase = await createSupabaseServer();

  const [byStatus, byEmployer, byTier] = await Promise.all([
    supabase
      .from('loans')
      .select('status, principal_ngwee, current_outstanding_ngwee, disbursed_amount_ngwee'),
    supabase
      .from('loans')
      .select(
        'employer_id, principal_ngwee, current_outstanding_ngwee, disbursed_amount_ngwee, employers(legal_name)',
      ),
    supabase.from('loan_applications').select('tier, status'),
  ]);

  type LoanAgg = { status: string; principal_ngwee: number | null; current_outstanding_ngwee: number | null; disbursed_amount_ngwee: number | null };
  type EmployerAgg = { employer_id: string; principal_ngwee: number | null; current_outstanding_ngwee: number | null; disbursed_amount_ngwee: number | null; employers: { legal_name: string } | null };
  type TierAgg = { tier: string | null; status: string };

  const statuses = aggregateLoans((byStatus.data ?? []) as LoanAgg[], (r) => r.status);
  const employers = aggregateLoans(
    (byEmployer.data ?? []) as unknown as EmployerAgg[],
    (r) => r.employers?.legal_name ?? '(no employer)',
  );
  const tiers = (byTier.data ?? []).reduce<Record<string, Record<string, number>>>((acc, r) => {
    const t = (r as TierAgg).tier ?? '(none)';
    const s = (r as TierAgg).status;
    acc[t] = acc[t] ?? {};
    acc[t][s] = (acc[t][s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Portfolio snapshot for management + BoZ submissions. Numbers are live.
          </p>
        </div>
        <Link href="/api/reports/system-overview.pdf" prefetch={false}>
          <Button>
            <Download className="h-4 w-4" />
            System overview PDF
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio by loan status</CardTitle>
          <CardDescription>Count and value of loans in each lifecycle state.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <AggTable rows={statuses} keyHeader="Status" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio by employer</CardTitle>
          <CardDescription>Exposure per partner organisation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <AggTable rows={employers} keyHeader="Employer" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application pipeline by tier</CardTitle>
          <CardDescription>How applications are distributed across L1/L2/L3.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3 font-medium">Tier</th>
                <th className="px-6 py-3 font-medium">By status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tiers).map(([tier, byStatus]) => (
                <tr key={tier} className="border-b border-ink-muted/5 last:border-0">
                  <td className="px-6 py-3 font-mono text-xs text-ink-base">{tier}</td>
                  <td className="px-6 py-3 text-ink-muted">
                    {Object.entries(byStatus)
                      .map(([s, n]) => `${s}: ${n}`)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
              {Object.keys(tiers).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-ink-muted">
                    No applications.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

interface AggRow {
  key: string;
  count: number;
  principal: number;
  outstanding: number;
  disbursed: number;
}

function aggregateLoans<T extends { principal_ngwee: number | null; current_outstanding_ngwee: number | null; disbursed_amount_ngwee: number | null }>(
  rows: T[],
  keyOf: (r: T) => string,
): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = map.get(k) ?? { key: k, count: 0, principal: 0, outstanding: 0, disbursed: 0 };
    cur.count += 1;
    cur.principal += Number(r.principal_ngwee ?? 0);
    cur.outstanding += Number(r.current_outstanding_ngwee ?? 0);
    cur.disbursed += Number(r.disbursed_amount_ngwee ?? 0);
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
}

function AggTable({ rows, keyHeader }: { rows: AggRow[]; keyHeader: string }): React.ReactElement {
  if (rows.length === 0) {
    return <div className="px-6 py-8 text-center text-sm text-ink-muted">No loans yet.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
          <th className="px-6 py-3 font-medium">{keyHeader}</th>
          <th className="px-6 py-3 font-medium text-right">Count</th>
          <th className="px-6 py-3 font-medium text-right">Principal</th>
          <th className="px-6 py-3 font-medium text-right">Outstanding</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-ink-muted/5 last:border-0">
            <td className="px-6 py-3 text-ink-base">{r.key}</td>
            <td className="px-6 py-3 text-right text-ink-muted">{r.count}</td>
            <td className="px-6 py-3 text-right text-ink-muted">{formatZmw(r.principal)}</td>
            <td className="px-6 py-3 text-right text-ink-base">{formatZmw(r.outstanding)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
