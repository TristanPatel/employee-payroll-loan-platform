import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatZmw, ngweeToKwacha, formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function MyApplicationPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: apps } = await supabase
    .from('loan_applications')
    .select(
      `id, application_no, status, tier, product, application_type,
       requested_amount_ngwee, requested_tenure_months, purpose,
       monthly_interest_rate, admin_fee_pct, insurance_fee_pct,
       submitted_at, created_at,
       employers ( legal_name ),
       employer_attestations ( status ),
       contracts ( id, contract_type, status, document_storage_path )`
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!apps || apps.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold text-ink-base">My application</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-muted">
            You haven&apos;t submitted an application yet.{' '}
            <Link href="/portal/apply" className="text-richmond-primary hover:underline">
              Start one
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink-base">My applications</h1>
      {apps.map((app) => {
        const employerName =
          (app.employers as { legal_name?: string } | null)?.legal_name ?? 'Employer';
        const contracts = (app.contracts as Array<{ id: string; contract_type: string; status: string }> | null) ?? [];
        const pendingContract = contracts.find((c) => !['sealed', 'voided', 'expired'].includes(c.status));
        return (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle>{app.application_no ?? app.id.slice(0, 8)}</CardTitle>
              <CardDescription>
                {employerName} · {app.product} · {app.application_type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Status" value={statusLabel(app.status)} />
                <Row label="Tier" value={(app.tier ?? '—').toString().toUpperCase()} />
                <Row label="Amount" value={formatZmw(Number(app.requested_amount_ngwee))} />
                <Row label="Tenure" value={`${app.requested_tenure_months} months`} />
                <Row label="Monthly rate" value={`${(Number(app.monthly_interest_rate) * 100).toFixed(2)}%`} />
                <Row
                  label="Submitted"
                  value={app.submitted_at ? formatLusakaDateTime(app.submitted_at) : '—'}
                />
              </dl>
              {app.purpose ? <p className="mt-3 text-xs text-ink-muted">Purpose: {app.purpose}</p> : null}
              {(() => {
                const att = (app.employer_attestations as Array<{ status: string }> | null)?.[0];
                if (!att || ['approved', 'rejected', 'expired', 'withdrawn'].includes(app.status)) return null;
                return (
                  <p className="mt-2 text-xs">
                    Employer confirmation:{' '}
                    <span
                      className={
                        att.status === 'confirmed'
                          ? 'font-medium text-status-success'
                          : att.status === 'declined'
                            ? 'font-medium text-status-danger'
                            : 'font-medium text-status-warning'
                      }
                    >
                      {att.status === 'pending' ? 'waiting on your employer' : att.status}
                    </span>
                  </p>
                );
              })()}
              {pendingContract ? (
                <div className="mt-4 flex items-center justify-between rounded-md bg-richmond-primary/5 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-ink-base">
                      {pendingContract.contract_type.replace(/_/g, ' ')} awaits your signature
                    </div>
                    <div className="text-xs text-ink-muted">Status: {pendingContract.status}</div>
                  </div>
                  <Link href={`/portal/sign/${pendingContract.id}`}>
                    <Button size="sm">Sign now</Button>
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
      <p className="text-xs text-ink-muted">
        Showing {apps.length} application{apps.length === 1 ? '' : 's'}. K values are in Zambian
        Kwacha — K {ngweeToKwacha(100).toLocaleString('en-ZM')} = 1 K.
      </p>
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

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}
