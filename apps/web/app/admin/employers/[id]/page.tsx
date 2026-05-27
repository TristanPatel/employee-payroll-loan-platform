import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ngweeToKwacha } from '@eplp/shared';
import { SignatoryForm } from './signatory-form';

export const dynamic = 'force-dynamic';

export default async function EmployerDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const [{ data: employer }, { data: signatories }, { data: docs }, { data: payrollConfig }] =
    await Promise.all([
      supabase.from('employers').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle(),
      supabase
        .from('employer_signatories')
        .select('*')
        .eq('employer_id', params.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('employer_documents')
        .select('*')
        .eq('employer_id', params.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('employer_payroll_config')
        .select('*')
        .eq('employer_id', params.id)
        .maybeSingle(),
    ]);

  if (!employer) notFound();

  const rate = (Number(employer.monthly_interest_rate) * 100).toFixed(2);
  const dsr = (Number(employer.max_debt_ratio_pct) * 100).toFixed(0);
  const admin = (Number(employer.admin_fee_pct) * 100).toFixed(2);
  const insurance = (Number(employer.insurance_fee_pct) * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <Link href="/admin/employers" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary">
        <ArrowLeft className="h-3 w-3" />
        Back to employers
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-ink-base">{employer.legal_name}</h1>
        {employer.trading_name ? (
          <p className="text-sm text-ink-muted">Trading as {employer.trading_name}</p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lending economics</CardTitle>
            <CardDescription>Edit in /admin/employers/[id]/edit (Phase 3.5).</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Monthly interest" value={`${rate}%`} />
              <Row label="Admin fee" value={`${admin}%`} />
              <Row label="Insurance fee" value={`${insurance}%`} />
              <Row label="Max debt ratio" value={`${dsr}%`} />
              <Row label="Max tenure" value={`${employer.max_tenure_months} months`} />
              <Row label="Salary advance" value={employer.salary_advance_enabled ? `${employer.salary_advance_max_months} mo max` : 'Disabled'} />
              <Row label="Loan pool" value={`K ${ngweeToKwacha(Number(employer.total_loan_pool_ngwee)).toLocaleString('en-ZM')}`} />
              <Row label="Used" value={`K ${ngweeToKwacha(Number(employer.used_pool_ngwee)).toLocaleString('en-ZM')}`} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll cycle</CardTitle>
            <CardDescription>Day-of-month anchors.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Payroll run" value={`Day ${employer.payroll_run_day}`} />
              <Row label="Deduction cut-off" value={`Day ${employer.deduction_cutoff_day}`} />
              <Row label="Remittance" value={`Day ${employer.repayment_remittance_day}`} />
              <Row label="Settlement quote valid" value={`${employer.settlement_quote_validity_days} days`} />
              {payrollConfig?.submission_format ? <Row label="Submission format" value={payrollConfig.submission_format} /> : null}
              {payrollConfig?.payout_format ? <Row label="Payout format" value={payrollConfig.payout_format} /> : null}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Signatories</CardTitle>
            <CardDescription>HR / Finance staff authorised to countersign pre-approvals.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {signatories && signatories.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Position</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {signatories.map((s) => (
                  <tr key={s.id} className="border-t border-ink-muted/5">
                    <td className="py-2 font-medium text-ink-base">{s.full_name}</td>
                    <td className="py-2 text-ink-muted">{s.position}</td>
                    <td className="py-2 text-ink-muted">{s.email ?? '—'}</td>
                    <td className="py-2 text-ink-muted">{s.phone ?? '—'}</td>
                    <td className="py-2 text-ink-muted">{s.is_active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-muted">No signatories yet.</p>
          )}
          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Plus className="h-3 w-3" /> Add signatory
            </h3>
            <SignatoryForm employerId={params.id} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>MOU, specimen signatures, supporting paperwork.</CardDescription>
        </CardHeader>
        <CardContent>
          {docs && docs.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded border border-ink-muted/10 px-3 py-2">
                  <span>{d.doc_type}</span>
                  <span className="text-xs text-ink-muted">{d.storage_path}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">
              No documents uploaded yet. Storage upload UI lands in Phase 3.5.
            </p>
          )}
        </CardContent>
      </Card>
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
