import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { ApplyWizard, type ApplyContext } from './apply-wizard';
import { ngweeToKwacha, type Tables } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: { employer?: string; type?: string; from?: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/sign-in?next=/portal/apply');
  if (profile.role !== 'employee') {
    redirect('/sign-in?error=Employee%20portal%20is%20for%20employees%20only');
  }

  const supabase = await createSupabaseServer();
  const [{ data: employee }, { data: employers }] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    supabase
      .from('employers')
      .select('id, legal_name, monthly_interest_rate, admin_fee_pct, insurance_fee_pct, max_debt_ratio_pct, max_tenure_months, salary_advance_enabled, salary_advance_max_months')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('legal_name', { ascending: true }),
  ]);

  // Top-up / refinance context: load the source loan and verify it belongs to
  // this borrower and is collectable, before letting the wizard reference it.
  let context: ApplyContext | undefined;
  if (searchParams.from && (searchParams.type === 'top_up' || searchParams.type === 'refinance')) {
    const { data: srcLoan } = await supabase
      .from('loans')
      .select('id, loan_no, status, current_outstanding_ngwee, employee_id')
      .eq('id', searchParams.from)
      .maybeSingle();
    if (
      srcLoan &&
      employee &&
      srcLoan.employee_id === employee.id &&
      ['active', 'in_arrears'].includes(srcLoan.status)
    ) {
      context =
        searchParams.type === 'refinance'
          ? {
              product: 'payroll_loan',
              applicationType: 'refinancing',
              refinancedFromLoanId: srcLoan.id,
              settlementMethod: 'buyout',
              sourceLoanNo: srcLoan.loan_no ?? undefined,
              sourceOutstandingZmw: ngweeToKwacha(Number(srcLoan.current_outstanding_ngwee)),
            }
          : {
              product: 'top_up',
              applicationType: 'new_loan',
              sourceLoanNo: srcLoan.loan_no ?? undefined,
              sourceOutstandingZmw: ngweeToKwacha(Number(srcLoan.current_outstanding_ngwee)),
            };
    }
  }

  const preselectedEmployerId =
    searchParams.employer ??
    profile.employer_id ??
    employee?.employer_id ??
    employers?.[0]?.id ??
    '';

  const heading =
    context?.applicationType === 'refinancing'
      ? 'Refinance your loan'
      : context?.product === 'top_up'
        ? 'Top up your loan'
        : 'Apply for a loan';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">{heading}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Step through each section. Your progress is saved as you go.
        </p>
      </div>
      <ApplyWizard
        profile={profile}
        employee={(employee ?? null) as Tables<'employees'> | null}
        employers={employers ?? []}
        preselectedEmployerId={preselectedEmployerId}
        context={context}
      />
    </div>
  );
}
