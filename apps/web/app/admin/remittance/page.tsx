import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDate } from '@eplp/shared';
import { GenerateBatchForm } from './_components/generate-batch-form';

export const dynamic = 'force-dynamic';

export default async function RemittancePage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const [{ data: batches }, { data: employers }] = await Promise.all([
    supabase
      .from('remittance_batches')
      .select('id, employer_id, period_month, period_year, total_amount_ngwee, employee_count, status, sent_at, received_at, employers ( legal_name )')
      .is('deleted_at', null)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(50),
    supabase
      .from('employers')
      .select('id, legal_name')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('legal_name', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Remittance batches</h1>
        <p className="mt-1 text-sm text-ink-muted">
          One batch per (employer, calendar month). Generated from active-loan schedule lines
          falling in that period. Accounts marks sent → received → reconciled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a batch</CardTitle>
          <CardDescription>Idempotent — re-running just returns the existing batch.</CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateBatchForm employers={(employers ?? []) as never} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {batches && batches.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Employer</th>
                  <th className="px-6 py-3 text-right font-medium">Total</th>
                  <th className="px-6 py-3 text-right font-medium">Employees</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const employer = (b.employers as { legal_name?: string } | null)?.legal_name ?? '—';
                  return (
                    <tr key={b.id} className="border-b border-ink-muted/5 last:border-0">
                      <td className="px-6 py-3 text-ink-base">
                        <Link href={`/admin/remittance/${b.id}`} className="font-medium hover:text-richmond-primary">
                          {b.period_year}-{String(b.period_month).padStart(2, '0')}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-ink-muted">{employer}</td>
                      <td className="px-6 py-3 text-right text-ink-base">
                        {formatZmw(Number(b.total_amount_ngwee))}
                      </td>
                      <td className="px-6 py-3 text-right text-ink-muted">{b.employee_count}</td>
                      <td className="px-6 py-3 text-xs">{b.status}</td>
                      <td className="px-6 py-3 text-xs text-ink-muted">
                        {b.sent_at ? formatLusakaDate(b.sent_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No remittance batches yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
