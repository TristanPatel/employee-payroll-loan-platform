import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ngweeToKwacha } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function EmployersListPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: employers } = await supabase
    .from('employers')
    .select('id, legal_name, trading_name, status, total_loan_pool_ngwee, used_pool_ngwee, monthly_interest_rate, max_debt_ratio_pct')
    .is('deleted_at', null)
    .order('legal_name', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Employers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Partner organisations with an active payroll-deduction MOU.
          </p>
        </div>
        <Link href="/admin/employers/new">
          <Button>
            <Plus className="h-4 w-4" />
            New employer
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {employers && employers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Legal name</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Rate</th>
                  <th className="px-6 py-3 font-medium text-right">DSR cap</th>
                  <th className="px-6 py-3 font-medium text-right">Pool used / total</th>
                </tr>
              </thead>
              <tbody>
                {employers.map((e) => (
                  <tr key={e.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/employers/${e.id}`}
                        className="font-medium text-ink-base hover:text-richmond-primary"
                      >
                        {e.legal_name}
                      </Link>
                      {e.trading_name ? (
                        <div className="text-xs text-ink-muted">{e.trading_name}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-6 py-3 text-right text-ink-base">
                      {(Number(e.monthly_interest_rate) * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-3 text-right text-ink-base">
                      {(Number(e.max_debt_ratio_pct) * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-3 text-right text-ink-muted">
                      K{ngweeToKwacha(Number(e.used_pool_ngwee)).toLocaleString('en-ZM')} / K
                      {ngweeToKwacha(Number(e.total_loan_pool_ngwee)).toLocaleString('en-ZM')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No employers yet. Add the first one to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const map: Record<string, string> = {
    active: 'bg-status-success/10 text-status-success',
    suspended: 'bg-status-warning/10 text-status-warning',
    archived: 'bg-ink-muted/10 text-ink-muted',
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
