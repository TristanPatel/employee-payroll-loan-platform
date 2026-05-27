import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZmw, formatLusakaDate, formatLusakaDateTime } from '@eplp/shared';
import { ApplicationStatusBadge } from '../_components/status-badge';
import { DueDiligencePanel } from './_components/due-diligence-panel';
import { ApprovalActions } from './_components/approval-actions';
import { CseReviewLaunch } from './_components/cse-review-launch';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) notFound();
  const supabase = await createSupabaseServer();

  const { data: app } = await supabase
    .from('loan_applications')
    .select(`*,
             employees ( profile_id, profiles ( full_name, nrc_no, email, phone ) ),
             employers ( legal_name, slug ),
             branches ( branch_code ),
             contracts ( id, contract_type, status )`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!app) notFound();

  const [{ data: checks }, { data: signoffs }, { data: approvals }] = await Promise.all([
    supabase
      .from('due_diligence_checks')
      .select('*')
      .eq('application_id', app.id)
      .is('deleted_at', null)
      .order('phase', { ascending: true })
      .order('item_no', { ascending: true }),
    supabase
      .from('due_diligence_signoffs')
      .select('*, profiles ( full_name )')
      .eq('application_id', app.id)
      .is('deleted_at', null)
      .order('signed_at', { ascending: true }),
    supabase
      .from('approvals')
      .select('*, profiles ( full_name, role )')
      .eq('application_id', app.id)
      .is('deleted_at', null)
      .order('decided_at', { ascending: true }),
  ]);

  const borrower =
    (app.employees as { profiles?: { full_name?: string; nrc_no?: string; email?: string; phone?: string } } | null)
      ?.profiles ?? {};
  const employerName = (app.employers as { legal_name?: string } | null)?.legal_name ?? '—';
  const contract = ((app.contracts as Array<{ id: string; contract_type: string; status: string }> | null) ?? [])
    .find((c) => c.contract_type === 'loan_agreement');

  const signoffRoles = new Set((signoffs ?? []).map((s) => s.role_key));
  const callerIsMaker = app.created_by === profile.id;
  const callerHasApproved = (approvals ?? []).some((a) => a.approver_id === profile.id);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to queue
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            {app.application_no ?? app.id.slice(0, 8)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-base">
            {borrower.full_name ?? 'Unknown borrower'} · {formatZmw(Number(app.requested_amount_ngwee))}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {employerName} · {app.product} · tier {(app.tier ?? '—').toString().toUpperCase()} ·
            {' '}
            {app.requested_tenure_months} months
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ApplicationStatusBadge status={app.status} />
          {app.submitted_at ? (
            <p className="text-xs text-ink-muted">submitted {formatLusakaDate(app.submitted_at)}</p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Borrower + loan details */}
          <Card>
            <CardHeader>
              <CardTitle>Borrower &amp; loan</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Full name" value={borrower.full_name ?? '—'} />
                <Row label="NRC" value={borrower.nrc_no ?? '—'} />
                <Row label="Email" value={borrower.email ?? '—'} />
                <Row label="Phone" value={borrower.phone ?? '—'} />
                <Row label="Employer" value={employerName} />
                <Row label="Branch"
                     value={(app.branches as { branch_code?: string } | null)?.branch_code ?? '—'} />
                <Row label="Requested" value={formatZmw(Number(app.requested_amount_ngwee))} />
                <Row label="Tenure" value={`${app.requested_tenure_months} months`} />
                <Row label="Monthly rate"
                     value={`${(Number(app.monthly_interest_rate) * 100).toFixed(2)}%`} />
                <Row label="Net pay"
                     value={app.net_pay_ngwee ? formatZmw(Number(app.net_pay_ngwee)) : '—'} />
                <Row label="Existing obligations"
                     value={formatZmw(Number(app.existing_obligations_ngwee))} />
                <Row label="Debt ratio"
                     value={app.debt_ratio_pct != null ? `${Number(app.debt_ratio_pct).toFixed(1)}%` : '—'} />
              </dl>
              {app.purpose ? (
                <p className="mt-4 rounded-md border border-ink-muted/10 bg-surface-base p-3 text-xs text-ink-muted">
                  <strong className="text-ink-base">Purpose:</strong> {app.purpose}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Due diligence (only meaningful in cse_review) */}
          {(['cse_review', 'l1_pending', 'l2_pending', 'l3_pending', 'approved', 'rejected'] as string[]).includes(
            app.status,
          ) ? (
            <DueDiligencePanel
              applicationId={app.id}
              status={app.status}
              checks={checks ?? []}
              signoffs={(signoffs ?? []) as never}
              canEdit={
                app.status === 'cse_review' &&
                (['cse', 'branch_manager', 'master_admin'] as string[]).includes(profile.role)
              }
              canSignoffCse={
                app.status === 'cse_review' &&
                (['cse', 'master_admin'] as string[]).includes(profile.role) &&
                !signoffRoles.has('cse')
              }
              canSignoffBranchManager={
                app.status === 'cse_review' &&
                (['branch_manager', 'master_admin'] as string[]).includes(profile.role) &&
                !signoffRoles.has('branch_manager')
              }
            />
          ) : null}

          {/* Approval history */}
          {(approvals ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Approval trail</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="pb-2 font-medium">Tier</th>
                      <th className="pb-2 font-medium">Decision</th>
                      <th className="pb-2 font-medium">Approver</th>
                      <th className="pb-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(approvals ?? []).map((a) => {
                      const approver = (a.profiles as { full_name?: string; role?: string } | null);
                      return (
                        <tr key={a.id} className="border-t border-ink-muted/5 align-top">
                          <td className="py-2 font-medium text-ink-base">{a.tier.toUpperCase()}</td>
                          <td className="py-2 text-ink-base">
                            <span
                              className={
                                a.decision === 'approve'
                                  ? 'text-status-success'
                                  : a.decision === 'reject'
                                    ? 'text-status-danger'
                                    : 'text-status-warning'
                              }
                            >
                              {a.decision}
                            </span>
                          </td>
                          <td className="py-2 text-ink-muted">
                            {approver?.full_name ?? '—'}
                            <span className="ml-1 text-xs">({approver?.role ?? '—'})</span>
                          </td>
                          <td className="py-2 text-xs text-ink-muted">
                            {formatLusakaDateTime(a.decided_at)}
                            {a.notes ? <div className="mt-1 text-[11px]">{a.notes}</div> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Sidebar: actions */}
        <div className="space-y-6">
          {/* CSE Review launch */}
          {(['submitted', 'employer_review', 'employer_confirmed'] as string[]).includes(app.status) &&
          (['cse', 'branch_manager', 'master_admin'] as string[]).includes(profile.role) ? (
            <CseReviewLaunch applicationId={app.id} hasContract={Boolean(contract)} />
          ) : null}

          {/* Approval actions */}
          {(['l1_pending', 'l2_pending', 'l3_pending'] as string[]).includes(app.status) ? (
            <ApprovalActions
              applicationId={app.id}
              status={app.status as 'l1_pending' | 'l2_pending' | 'l3_pending'}
              callerRole={profile.role}
              callerIsMaker={callerIsMaker}
              callerHasApproved={callerHasApproved}
            />
          ) : null}

          {/* Contract status */}
          <Card>
            <CardHeader>
              <CardTitle>Loan agreement</CardTitle>
              <CardDescription>
                {contract ? `Status: ${contract.status}` : 'No loan_agreement contract created yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contract ? (
                <Link
                  href={`/verify/${contract.id}`}
                  className="text-sm text-richmond-primary hover:underline"
                >
                  View on public verifier ›
                </Link>
              ) : null}
            </CardContent>
          </Card>
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
