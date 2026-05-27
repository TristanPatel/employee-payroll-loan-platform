import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDate, formatLusakaDateTime } from '@eplp/shared';
import { TransitionActions } from './_components/transition-actions';

export const dynamic = 'force-dynamic';

export default async function RemittanceDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) notFound();
  const supabase = await createSupabaseServer();

  const { data: batch } = await supabase
    .from('remittance_batches')
    .select('*, employers ( legal_name )')
    .eq('id', params.id)
    .maybeSingle();
  if (!batch) notFound();

  // Pull the underlying schedule lines for the batch
  const { data: lines } = await supabase
    .from('loan_schedule')
    .select(`scheduled_amount_ngwee, due_date, instalment_no, status,
             loans ( loan_no, employee_id,
                     employees ( profiles ( full_name, nrc_no ) ) )`)
    .gte('due_date', `${batch.period_year}-${String(batch.period_month).padStart(2, '0')}-01`)
    .lt('due_date', monthEnd(batch.period_year, batch.period_month))
    .in('status', ['scheduled', 'partial'])
    .is('deleted_at', null);

  const employerLines = (lines ?? []).filter((l) => {
    return (l.loans as { employer_id?: string; loan_no?: string } | null);
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/remittance" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary">
        <ArrowLeft className="h-3 w-3" />
        Back to remittance
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            {(batch.employers as { legal_name?: string } | null)?.legal_name ?? '—'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-base">
            {batch.period_year}-{String(batch.period_month).padStart(2, '0')} · {formatZmw(Number(batch.total_amount_ngwee))}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {batch.employee_count} employee{batch.employee_count === 1 ? '' : 's'} · status {batch.status}
          </p>
        </div>
        <TransitionActions
          batchId={batch.id}
          status={batch.status}
          totalNgwee={Number(batch.total_amount_ngwee)}
          canActAccounts={(['accounts', 'master_admin'] as string[]).includes(profile.role)}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Created" value={formatLusakaDateTime(batch.created_at)} />
            <Row label="Sent" value={batch.sent_at ? formatLusakaDateTime(batch.sent_at) : '—'} />
            <Row label="Received" value={batch.received_at ? formatLusakaDateTime(batch.received_at) : '—'} />
          </dl>
          {batch.notes ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-md border border-ink-muted/10 bg-surface-base p-3 text-xs text-ink-base">
              {batch.notes}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deduction lines</CardTitle>
          <CardDescription>
            What the employer payroll will deduct from each employee&apos;s salary this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-muted/10 text-left text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2 font-medium">Loan #</th>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">NRC</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Instal. #</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {employerLines.map((l, i) => {
                const loan = l.loans as { loan_no?: string; employees?: { profiles?: { full_name?: string; nrc_no?: string } } } | null;
                const emp = loan?.employees?.profiles ?? {};
                return (
                  <tr key={i} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-4 py-1.5 font-medium text-ink-base">{loan?.loan_no ?? '—'}</td>
                    <td className="px-4 py-1.5 text-ink-muted">{emp.full_name ?? '—'}</td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-ink-muted">{emp.nrc_no ?? '—'}</td>
                    <td className="px-4 py-1.5 text-ink-muted">{formatLusakaDate(l.due_date)}</td>
                    <td className="px-4 py-1.5 text-ink-muted">{l.instalment_no}</td>
                    <td className="px-4 py-1.5 text-right font-medium text-ink-base">
                      {formatZmw(Number(l.scheduled_amount_ngwee))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-surface-base">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right font-medium text-ink-base">
                  Batch total
                </td>
                <td className="px-4 py-2 text-right font-bold text-ink-base">
                  {formatZmw(Number(batch.total_amount_ngwee))}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-ink-base">{value}</dd>
    </div>
  );
}

function monthEnd(year: number, month: number): string {
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return next;
}
