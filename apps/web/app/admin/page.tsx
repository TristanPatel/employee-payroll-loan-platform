import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  ArrowRight,
  ClipboardList,
  Coins,
  Landmark,
  TrendingUp,
} from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatZmw } from '@eplp/shared';
import { Sparkline, dailySeries } from '@/components/sparkline';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();

  const [
    employers,
    branches,
    profiles,
    applicationsPending,
    loansActive,
    loansPendingDisbursement,
    disbursedAgg,
    outstandingAgg,
    appTrendRows,
    repayTrendRows,
  ] = await Promise.all([
    supabase.from('employers').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('branches').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('loan_applications')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'cse_review', 'l1_pending', 'l2_pending', 'l3_pending']),
    supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'in_arrears']),
    supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_disbursement'),
    supabase.from('loans').select('disbursed_amount_ngwee').neq('status', 'pending_disbursement'),
    supabase
      .from('loans')
      .select('current_outstanding_ngwee')
      .in('status', ['active', 'in_arrears']),
    supabase
      .from('loan_applications')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase
      .from('repayments')
      .select('payment_date, amount_ngwee')
      .gte('payment_date', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const totalDisbursed = (disbursedAgg.data ?? []).reduce(
    (s, r) => s + Number(r.disbursed_amount_ngwee ?? 0),
    0,
  );
  const totalOutstanding = (outstandingAgg.data ?? []).reduce(
    (s, r) => s + Number(r.current_outstanding_ngwee ?? 0),
    0,
  );

  const appsPerDay = dailySeries(
    (appTrendRows.data ?? []).map((r) => ({ at: r.created_at as string })),
    30,
  );
  const repaymentsPerDay = dailySeries(
    (repayTrendRows.data ?? []).map((r) => ({
      at: r.payment_date as string,
      value: Number(r.amount_ngwee ?? 0) / 100,
    })),
    30,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Lending estate at a glance — every figure live from the database.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          href="/admin/applications"
          icon={ClipboardList}
          label="Open applications"
          value={applicationsPending.count ?? 0}
          description="Awaiting review or approval"
        />
        <StatCard
          href="/admin/loans"
          icon={Coins}
          label="Active loans"
          value={loansActive.count ?? 0}
          description="Currently being repaid"
        />
        <StatCard
          href="/admin/loans"
          icon={Landmark}
          label="Pending disbursement"
          value={loansPendingDisbursement.count ?? 0}
          description="Approved, awaiting payout"
        />
        <StatCard
          href="/admin/remittance"
          icon={TrendingUp}
          label="Total outstanding"
          value={formatZmw(totalOutstanding)}
          description="Across all active loans"
          isMoney
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/admin/employers"
          icon={Building2}
          label="Employers"
          value={employers.count ?? 0}
          description="Active partner organisations"
        />
        <StatCard
          href="/admin/branches"
          icon={Briefcase}
          label="Branches"
          value={branches.count ?? 0}
          description="Richmond branch network"
        />
        <StatCard
          href="/admin/staff"
          icon={Users}
          label="Accounts"
          value={profiles.count ?? 0}
          description="Staff, employer HR, borrowers"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications — last 30 days</CardTitle>
            <CardDescription>
              {appsPerDay.reduce((a, b) => a + b, 0)} submitted; live trend by day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Sparkline data={appsPerDay} width={420} height={48} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repayments — last 30 days</CardTitle>
            <CardDescription>
              {formatZmw(Math.round(repaymentsPerDay.reduce((a, b) => a + b, 0) * 100))} collected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Sparkline data={repaymentsPerDay} width={420} height={48} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifetime disbursement</CardTitle>
          <CardDescription>Total cash advanced to borrowers since launch.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-ink-base">{formatZmw(totalDisbursed)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  description,
  isMoney,
}: {
  href: string;
  icon: typeof Building2;
  label: string;
  value: number | string;
  description: string;
  isMoney?: boolean;
}): React.ReactElement {
  return (
    <Link href={href} className="block">
      <Card className="transition hover:border-richmond-primary/40">
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div
              className={
                isMoney
                  ? 'mt-2 text-2xl font-semibold text-ink-base'
                  : 'mt-2 text-3xl font-semibold text-ink-base'
              }
            >
              {value}
            </div>
            <div className="mt-1 text-xs text-ink-muted">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-muted" />
        </CardContent>
      </Card>
    </Link>
  );
}
