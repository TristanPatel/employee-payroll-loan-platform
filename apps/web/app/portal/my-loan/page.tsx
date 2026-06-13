import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDate } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function MyLoanPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: loans } = await supabase
    .from('loans')
    .select(`id, loan_no, status, principal_ngwee, monthly_installment_ngwee,
             current_outstanding_ngwee, disbursed_amount_ngwee,
             total_collectable_ngwee, start_date, end_date, tenure_months,
             disbursement_method, disbursement_ref, disbursed_at,
             loan_schedule ( instalment_no, due_date, scheduled_amount_ngwee, status )`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!loans || loans.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold text-ink-base">My loan</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-muted">
            You don&apos;t have any active loans yet.{' '}
            <Link href="/portal/apply" className="text-richmond-primary hover:underline">
              Apply for one
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink-base">My loans</h1>
      {loans.map((l) => {
        const schedule = ((l.loan_schedule as Array<{ instalment_no: number; due_date: string; scheduled_amount_ngwee: number; status: string }> | null) ?? [])
          .slice()
          .sort((a, b) => a.instalment_no - b.instalment_no);
        const nextDue = schedule.find((s) => s.status === 'scheduled');
        const totalPaid = Number(l.total_collectable_ngwee) - Number(l.current_outstanding_ngwee);
        const pctPaid = Math.round((totalPaid / Number(l.total_collectable_ngwee)) * 100);
        return (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle>{l.loan_no ?? l.id.slice(0, 8)}</CardTitle>
              <CardDescription>
                {l.status} · {l.tenure_months} months
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Principal" value={formatZmw(Number(l.principal_ngwee))} />
                <Row label="Disbursed" value={formatZmw(Number(l.disbursed_amount_ngwee))} />
                <Row label="Outstanding" value={formatZmw(Number(l.current_outstanding_ngwee))} />
                <Row label="Monthly instalment" value={formatZmw(Number(l.monthly_installment_ngwee))} />
                <Row label="Start" value={formatLusakaDate(l.start_date)} />
                <Row label="End" value={formatLusakaDate(l.end_date)} />
              </dl>

              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-muted">
                  <span>Repaid</span>
                  <span>{pctPaid}%</span>
                </div>
                <div className="h-2 rounded-full bg-ink-muted/10">
                  <div
                    className="h-2 rounded-full bg-status-success"
                    style={{ width: `${Math.min(pctPaid, 100)}%` }}
                  />
                </div>
              </div>

              {nextDue ? (
                <div className="rounded-md bg-richmond-primary/5 p-3 text-sm">
                  Next deduction: <strong>{formatZmw(Number(nextDue.scheduled_amount_ngwee))}</strong>{' '}
                  on <strong>{formatLusakaDate(nextDue.due_date)}</strong>.
                </div>
              ) : null}

              <details className="rounded-md border border-ink-muted/10 bg-white">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-ink-base">
                  Full repayment schedule
                </summary>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink-muted/10 bg-surface-base text-left text-[10px] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Due</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s) => (
                      <tr key={s.instalment_no} className="border-b border-ink-muted/5 last:border-0">
                        <td className="px-4 py-1.5 text-ink-base">{s.instalment_no}</td>
                        <td className="px-4 py-1.5 text-ink-muted">{formatLusakaDate(s.due_date)}</td>
                        <td className="px-4 py-1.5 text-right text-ink-base">
                          {formatZmw(Number(s.scheduled_amount_ngwee))}
                        </td>
                        <td className="px-4 py-1.5 text-ink-muted">{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>

              {['active', 'in_arrears'].includes(l.status) ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-ink-muted/10 pt-4">
                  <Link
                    href={`/portal/apply?type=top_up&from=${l.id}`}
                    className="rounded-md bg-richmond-primary px-4 py-2 text-sm font-medium text-white hover:bg-richmond-primary-dark"
                  >
                    Top up
                  </Link>
                  <Link
                    href={`/portal/apply?type=refinance&from=${l.id}`}
                    className="rounded-md border border-richmond-primary/30 px-4 py-2 text-sm font-medium text-richmond-primary hover:bg-richmond-primary/5"
                  >
                    Refinance
                  </Link>
                  <span className="text-xs text-ink-muted">
                    Top up adds a second loan; refinance replaces this one.
                  </span>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Link
                  href={`/portal/my-loan/statement?loan=${l.id}`}
                  prefetch={false}
                  className="text-xs font-medium text-richmond-primary hover:underline"
                >
                  Download loan statement (PDF) →
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-right text-ink-base">{value}</dd>
    </>
  );
}
