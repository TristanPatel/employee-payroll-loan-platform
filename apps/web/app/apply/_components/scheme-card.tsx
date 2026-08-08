import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { EmployerApplyInfo } from '@/lib/employer-entry';
import { StartButton } from './start-button';
import { SignupForm } from './signup-form';

function pct(v: number): string {
  return `${(Number(v) * 100).toFixed(2)}%`;
}

/**
 * Shown once a valid credential resolves to a single employer. Displays the
 * scheme's public terms only — never loan-pool figures or any other employer.
 * A signed-in borrower can start straight away (redeem binds them); a new
 * visitor creates an account first and is returned here to finish joining.
 */
export function SchemeCard({
  employer,
  token,
  code,
  signedIn,
}: {
  employer: EmployerApplyInfo;
  token?: string;
  code?: string;
  signedIn: boolean;
}): React.ReactElement {
  const returnTo = token ? `/join/${token}` : `/join?code=${encodeURIComponent(code ?? '')}`;
  return (
    <Card>
      <CardHeader>
        <CardDescription>You’re joining the loan scheme for</CardDescription>
        <CardTitle className="text-2xl">{employer.legal_name}</CardTitle>
        {employer.trading_name ? (
          <CardDescription>Trading as {employer.trading_name}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-ink-muted">Monthly interest</dt>
            <dd className="font-medium text-ink-base">{pct(employer.monthly_interest_rate)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Max tenure</dt>
            <dd className="font-medium text-ink-base">{employer.max_tenure_months} months</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Admin fee</dt>
            <dd className="font-medium text-ink-base">{pct(employer.admin_fee_pct)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Insurance fee</dt>
            <dd className="font-medium text-ink-base">{pct(employer.insurance_fee_pct)}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-muted">
          Repaid by direct salary deduction. Your maximum amount is worked out from your payslips
          during the application. Funds are disbursed to your bank account or mobile money.
        </p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        {signedIn ? (
          <StartButton token={token} code={code} />
        ) : (
          <>
            <p className="text-sm font-medium text-ink-base">Create your account to continue</p>
            <SignupForm returnTo={returnTo} />
          </>
        )}
      </CardFooter>
    </Card>
  );
}
