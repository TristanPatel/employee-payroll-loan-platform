import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDate, formatLusakaDateTime } from '@eplp/shared';
import { DisbursementForm } from './_components/disbursement-form';

export const dynamic = 'force-dynamic';

export default async function LoanDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) notFound();
  const supabase = await createSupabaseServer();

  const { data: loan } = await supabase
    .from('loans')
    .select(`*,
             employees ( profiles ( full_name, nrc_no, phone_e164 ) ),
             employers ( legal_name ),
             loan_applications ( application_no )`)
    .eq('id', params.id)
    .maybeSingle();
  if (!loan) notFound();

  const { data: schedule } = await supabase
    .from('loan_schedule')
    .select('*')
    .eq('loan_id', loan.id)
    .is('deleted_at', null)
    .order('instalment_no', { ascending: true });

  const { data: authorisers } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['branch_manager', 'cfo', 'master_admin'] as never)
    .neq('id', profile.id)
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  const borrower = (loan.employees as { profiles?: { full_name?: string; nrc_no?: string; phone_e164?: string } } | null)?.profiles ?? {};
  const employerName = (loan.employers as { legal_name?: string } | null)?.legal_name ?? '—';
  const appNo = (loan.loan_applications as { application_no?: string } | null)?.application_no ?? '—';

  const canDisburse =
    loan.status === 'pending_disbursement' &&
    (['accounts', 'master_admin'] as string[]).includes(profile.role);

  return (
    <div className="space-y-6">
      <Link href="/admin/loans" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary">
        <ArrowLeft className="h-3 w-3" />
        Back to loans
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">{loan.loan_no ?? loan.id.slice(0, 8)}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-base">
            {borrower.full_name ?? '—'} · {formatZmw(Number(loan.principal_ngwee))}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {employerName} · {loan.product} · {loan.tenure_months} months · status {loan.status}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Loan terms</CardTitle>
              <CardDescription>Snapshot from application {appNo}.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Principal" value={formatZmw(Number(loan.principal_ngwee))} />
                <Row label="Monthly rate" value={`${(Number(loan.monthly_interest_rate) * 100).toFixed(2)}%`} />
                <Row label="Admin fee" value={formatZmw(Number(loan.admin_fee_ngwee))} />
                <Row label="Insurance fee" value={formatZmw(Number(loan.insurance_fee_ngwee))} />
                <Row label="Total interest" value={formatZmw(Number(loan.total_interest_ngwee))} />
                <Row label="Total collectable" value={formatZmw(Number(loan.total_collectable_ngwee))} />
                <Row label="Monthly instalment" value={formatZmw(Number(loan.monthly_installment_ngwee))} />
                <Row label="Disbursed amount" value={formatZmw(Number(loan.disbursed_amount_ngwee))} />
                <Row label="Outstanding" value={formatZmw(Number(loan.current_outstanding_ngwee))} />
                <Row label="Start" value={formatLusakaDate(loan.start_date)} />
                <Row label="End" value={formatLusakaDate(loan.end_date)} />
                <Row label="Borrower phone" value={borrower.phone_e164 ?? '—'} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repayment schedule</CardTitle>
              <CardDescription>
                {schedule?.length ?? 0} instalments · auto-generated from application terms.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-muted/10 text-left text-[10px] uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Due</th>
                    <th className="px-4 py-2 text-right font-medium">Principal</th>
                    <th className="px-4 py-2 text-right font-medium">Interest</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedule ?? []).map((s) => (
                    <tr key={s.id} className="border-b border-ink-muted/5 last:border-0">
                      <td className="px-4 py-1.5 font-medium text-ink-base">{s.instalment_no}</td>
                      <td className="px-4 py-1.5 text-ink-muted">{formatLusakaDate(s.due_date)}</td>
                      <td className="px-4 py-1.5 text-right text-ink-base">
                        {formatZmw(Number(s.principal_component_ngwee))}
                      </td>
                      <td className="px-4 py-1.5 text-right text-ink-muted">
                        {formatZmw(Number(s.interest_component_ngwee))}
                      </td>
                      <td className="px-4 py-1.5 text-right font-medium text-ink-base">
                        {formatZmw(Number(s.scheduled_amount_ngwee))}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-ink-muted">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canDisburse ? (
            <DisbursementForm
              loanId={loan.id}
              disbursedAmount={Number(loan.disbursed_amount_ngwee)}
              authorisers={(authorisers ?? []) as never}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Disbursement</CardTitle>
                <CardDescription>
                  {loan.status === 'pending_disbursement'
                    ? 'Accounts must record the bank-transfer evidence here.'
                    : `Already ${loan.status}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loan.disbursed_at ? (
                  <dl className="space-y-2 text-sm">
                    <Row label="Method" value={loan.disbursement_method ?? '—'} />
                    <Row label="Reference" value={loan.disbursement_ref ?? '—'} />
                    <Row label="Disbursed at" value={formatLusakaDateTime(loan.disbursed_at)} />
                  </dl>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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
