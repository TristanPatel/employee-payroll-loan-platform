import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ngweeToKwacha } from '@eplp/shared';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { LoanCalculator } from './loan-calculator';

export const dynamic = 'force-dynamic';

export default async function ApplyLandingPage({
  params,
}: {
  params: { slug: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: employer } = await supabase
    .from('employers')
    .select('id, legal_name, trading_name, slug, monthly_interest_rate, admin_fee_pct, insurance_fee_pct, max_debt_ratio_pct, max_tenure_months, salary_advance_enabled, salary_advance_max_months, total_loan_pool_ngwee, used_pool_ngwee, status')
    .eq('slug', params.slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (!employer || employer.status !== 'active') notFound();

  const rate = (Number(employer.monthly_interest_rate) * 100).toFixed(2);
  const adminFee = (Number(employer.admin_fee_pct) * 100).toFixed(2);
  const insuranceFee = (Number(employer.insurance_fee_pct) * 100).toFixed(2);
  const pool = ngweeToKwacha(Number(employer.total_loan_pool_ngwee));
  const used = ngweeToKwacha(Number(employer.used_pool_ngwee));
  const remaining = Math.max(0, pool - used);

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-ink-muted/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <RichmondLogo height={40} />
            <div>
              <div className="text-xs text-ink-muted">Employee Payroll Loan Portal</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Loan scheme</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink-base">{employer.legal_name}</h1>
          {employer.trading_name ? (
            <p className="text-sm text-ink-muted">Trading as {employer.trading_name}</p>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>About this scheme</CardTitle>
            <CardDescription>
              Repaid by direct salary deduction. Funds disbursed to your bank account or mobile money.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Monthly rate" value={`${rate}%`} />
              <Stat label="Admin fee" value={`${adminFee}%`} />
              <Stat label="Insurance fee" value={`${insuranceFee}%`} />
              <Stat label="Max tenure" value={`${employer.max_tenure_months} mo`} />
            </dl>
            <p className="mt-4 text-xs text-ink-muted">
              Pool remaining: K {remaining.toLocaleString('en-ZM')} of K {pool.toLocaleString('en-ZM')}.
              {employer.salary_advance_enabled
                ? ` Salary advance available, max ${employer.salary_advance_max_months} months.`
                : ''}
            </p>
          </CardContent>
          <CardFooter>
            <Link href={`/apply/${employer.slug}/signup`} className="ml-auto">
              <Button>Start application</Button>
            </Link>
          </CardFooter>
        </Card>

        <LoanCalculator
          monthlyRate={Number(employer.monthly_interest_rate)}
          adminFeePct={Number(employer.admin_fee_pct)}
          insuranceFeePct={Number(employer.insurance_fee_pct)}
          maxDebtRatioPct={Number(employer.max_debt_ratio_pct)}
          maxTenureMonths={employer.max_tenure_months ?? 12}
        />

        <Card>
          <CardHeader>
            <CardTitle>What you&apos;ll need</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-4 list-disc space-y-1 text-sm text-ink-base">
              <li>Your National Registration Card (NRC) — front and back</li>
              <li>A passport-style photo of yourself</li>
              <li>Three most recent payslips (originals, no alterations)</li>
              <li>Employment contract or confirmation letter</li>
              <li>Proof of banking (bank statement showing your name)</li>
              <li>Proof of residence</li>
            </ul>
            <p className="mt-4 text-xs text-ink-muted">
              The whole journey takes 10–15 minutes if you have your documents handy.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-ink-base">{value}</dd>
    </div>
  );
}
