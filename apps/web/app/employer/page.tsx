import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDateTime } from '@eplp/shared';
import { AttestRow } from './attest-row';

export const dynamic = 'force-dynamic';

export default async function EmployerHomePage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: attestations } = await supabase
    .from('employer_attestations')
    .select(
      `id, application_id, status, application_no_snapshot, employee_name_snapshot,
       employee_no_snapshot, basic_salary_ngwee, monthly_deduction_ngwee,
       tenure_months, requested_at, attested_at, decline_reason`,
    )
    .order('requested_at', { ascending: false });

  const pending = (attestations ?? []).filter((a) => a.status === 'pending');
  const done = (attestations ?? []).filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Payroll-deduction confirmations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          For each request, confirm that the person is your employee at the stated salary and
          that the monthly deduction will be remitted to Richmond Finance. You see only the
          details needed for that confirmation — never the loan purpose or personal financials.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting your confirmation ({pending.length})</CardTitle>
          <CardDescription>
            Richmond&apos;s credit review runs in parallel — your confirmation is required before
            any loan is finally approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium text-right">Basic salary</th>
                  <th className="px-6 py-3 font-medium text-right">Monthly deduction</th>
                  <th className="px-6 py-3 font-medium text-right">Months</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((a) => (
                  <tr key={a.id} className="border-b border-ink-muted/5 align-middle last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-medium text-ink-base">{a.employee_name_snapshot}</div>
                      <div className="text-xs text-ink-muted">
                        #{a.employee_no_snapshot} · {a.application_no_snapshot} ·{' '}
                        {formatLusakaDateTime(a.requested_at)}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-ink-base">
                      {formatZmw(Number(a.basic_salary_ngwee ?? 0))}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-ink-base">
                      {formatZmw(Number(a.monthly_deduction_ngwee ?? 0))}
                    </td>
                    <td className="px-6 py-3 text-right text-ink-muted">{a.tenure_months}</td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end">
                        <AttestRow applicationId={a.application_id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-ink-muted">
              Nothing waiting. New requests appear here automatically.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {done.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {done.map((a) => (
                  <tr key={a.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-medium text-ink-base">{a.employee_name_snapshot}</div>
                      <div className="text-xs text-ink-muted">{a.application_no_snapshot}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          a.status === 'confirmed'
                            ? 'bg-status-success/10 text-status-success'
                            : 'bg-status-danger/10 text-status-danger'
                        }`}
                      >
                        {a.status}
                      </span>
                      {a.decline_reason ? (
                        <span className="ml-2 text-xs text-ink-muted">{a.decline_reason}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-ink-muted">
                      {a.attested_at ? formatLusakaDateTime(a.attested_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-ink-muted">No decisions yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
