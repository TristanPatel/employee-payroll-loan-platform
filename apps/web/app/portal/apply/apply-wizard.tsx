'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  computePayeMonthly,
  computeNapsaMonthly,
  computeNhimaMonthly,
  computeAffordability,
  computeInterest,
  computeFees,
  formatZmw,
  ngweeToKwacha,
  type Tables,
} from '@eplp/shared';
import {
  saveApplyProfile,
  saveApplyEmployment,
  saveApplyBank,
  submitApplication,
  type FormState,
} from './actions';
import { DocumentUpload } from './document-upload';

type EmployerLite = Pick<
  Tables<'employers'>,
  | 'id'
  | 'legal_name'
  | 'monthly_interest_rate'
  | 'admin_fee_pct'
  | 'insurance_fee_pct'
  | 'max_debt_ratio_pct'
  | 'max_tenure_months'
  | 'salary_advance_enabled'
  | 'salary_advance_max_months'
>;

type Step = 'profile' | 'employment' | 'bank' | 'documents' | 'amount' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'employment', label: 'Employment' },
  { key: 'bank', label: 'Bank' },
  { key: 'documents', label: 'Documents' },
  { key: 'amount', label: 'Amount' },
  { key: 'review', label: 'Review & submit' },
];

export function ApplyWizard({
  profile,
  employee,
  employers,
  preselectedEmployerId,
}: {
  profile: Tables<'profiles'>;
  employee: Tables<'employees'> | null;
  employers: EmployerLite[];
  preselectedEmployerId: string;
}): React.ReactElement {
  const [step, setStep] = useState<Step>('profile');
  const [applicationId] = useState<string>(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2);
  });
  const selectedEmployer = employers.find((e) => e.id === preselectedEmployerId) ?? employers[0];
  const [employerId, setEmployerId] = useState<string>(preselectedEmployerId);
  const [requestedAmount, setRequestedAmount] = useState<number>(5000);
  const [tenure, setTenure] = useState<number>(6);
  const [existingObligations, setExistingObligations] = useState<number>(0);
  const [basicPay, setBasicPay] = useState<number>(
    employee?.salary_basic_ngwee ? ngweeToKwacha(Number(employee.salary_basic_ngwee)) : 0,
  );
  const [allowances, setAllowances] = useState<number>(
    employee?.salary_allowances_ngwee ? ngweeToKwacha(Number(employee.salary_allowances_ngwee)) : 0,
  );

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    const next = STEPS[currentIdx + 1];
    if (next) setStep(next.key);
  }
  function goPrev() {
    const prev = STEPS[currentIdx - 1];
    if (prev) setStep(prev.key);
  }

  // Live calculator inputs (review step)
  const calc = useMemo(() => {
    if (!selectedEmployer) return null;
    const gross = basicPay + allowances;
    const napsa = computeNapsaMonthly(basicPay);
    const nhima = computeNhimaMonthly(basicPay);
    const paye = computePayeMonthly(gross - napsa);
    const monthlyRate = Number(selectedEmployer.monthly_interest_rate);
    const interest = computeInterest({
      principalZmw: requestedAmount,
      monthlyRate,
      tenureMonths: tenure,
    });
    const fees = computeFees({
      principalZmw: requestedAmount,
      adminFeePct: Number(selectedEmployer.admin_fee_pct),
      insuranceFeePct: Number(selectedEmployer.insurance_fee_pct),
    });
    const aff = computeAffordability(
      {
        grossPayZmw: gross,
        basicPayZmw: basicPay,
        payeZmw: paye,
        napsaZmw: napsa,
        nhimaZmw: nhima,
        otherStatutoryZmw: 0,
        existingObligationsZmw: existingObligations,
        monthlyInterestRate: monthlyRate,
        tenureMonths: tenure,
        proposedPrincipalZmw: requestedAmount,
      },
      Number(selectedEmployer.max_debt_ratio_pct),
    );
    return { gross, napsa, nhima, paye, interest, fees, aff, monthlyRate };
  }, [basicPay, allowances, requestedAmount, tenure, existingObligations, selectedEmployer]);

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} active={step} />
      {step === 'profile' && (
        <ProfileStep profile={profile} onDone={goNext} />
      )}
      {step === 'employment' && (
        <EmploymentStep
          employee={employee}
          employers={employers}
          employerId={employerId}
          setEmployerId={setEmployerId}
          basicPay={basicPay}
          setBasicPay={setBasicPay}
          allowances={allowances}
          setAllowances={setAllowances}
          onDone={goNext}
          onBack={goPrev}
        />
      )}
      {step === 'bank' && (
        <BankStep employee={employee} onDone={goNext} onBack={goPrev} />
      )}
      {step === 'documents' && (
        <DocumentsStep applicationId={applicationId} onDone={goNext} onBack={goPrev} />
      )}
      {step === 'amount' && selectedEmployer && (
        <AmountStep
          employer={selectedEmployer}
          requestedAmount={requestedAmount}
          setRequestedAmount={setRequestedAmount}
          tenure={tenure}
          setTenure={setTenure}
          existingObligations={existingObligations}
          setExistingObligations={setExistingObligations}
          calc={calc}
          onDone={goNext}
          onBack={goPrev}
        />
      )}
      {step === 'review' && selectedEmployer && calc && (
        <ReviewStep
          employer={selectedEmployer}
          requestedAmount={requestedAmount}
          tenure={tenure}
          existingObligations={existingObligations}
          calc={calc}
          onBack={goPrev}
        />
      )}
    </div>
  );
}

function Stepper({ steps, active }: { steps: { key: Step; label: string }[]; active: Step }): React.ReactElement {
  const activeIdx = steps.findIndex((s) => s.key === active);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto rounded-md border border-ink-muted/10 bg-white px-3 py-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1">
          <span
            className={cn(
              'grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold',
              i < activeIdx
                ? 'bg-status-success text-white'
                : i === activeIdx
                  ? 'bg-richmond-primary text-white'
                  : 'bg-ink-muted/15 text-ink-muted',
            )}
          >
            {i < activeIdx ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </span>
          <span className={cn(i === activeIdx ? 'font-medium text-ink-base' : 'text-ink-muted')}>{s.label}</span>
          {i < steps.length - 1 ? <span className="px-1 text-ink-muted/40">›</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ProfileStep({
  profile,
  onDone,
}: {
  profile: Tables<'profiles'>;
  onDone: () => void;
}): React.ReactElement {
  const [state, action] = useFormState<FormState, FormData>(async (prev, fd) => {
    const r = await saveApplyProfile(prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>This is the information that appears on every Richmond contract.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="salutation">Title</Label>
            <select id="salutation" name="salutation" defaultValue={profile.salutation ?? ''} className="mt-1 h-10 w-full rounded-md border border-ink-muted/20 bg-white px-3 text-sm">
              <option value="">—</option>
              <option value="mr">Mr</option>
              <option value="mrs">Mrs</option>
              <option value="miss">Miss</option>
              <option value="dr">Dr</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label htmlFor="first_name" required>First name</Label>
            <Input id="first_name" name="first_name" defaultValue={profile.first_name ?? ''} required className="mt-1" />
            <FieldError message={state.fieldErrors?.first_name} />
          </div>
          <div>
            <Label htmlFor="middle_name">Middle name</Label>
            <Input id="middle_name" name="middle_name" defaultValue={profile.middle_name ?? ''} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="surname" required>Surname</Label>
            <Input id="surname" name="surname" defaultValue={profile.surname ?? ''} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="nrc_no" required>NRC</Label>
            <Input id="nrc_no" name="nrc_no" defaultValue={profile.nrc_no ?? ''} required placeholder="123456/78/9" className="mt-1" />
            <FieldError message={state.fieldErrors?.nrc_no} />
          </div>
          <div>
            <Label htmlFor="date_of_birth" required>Date of birth</Label>
            <Input id="date_of_birth" name="date_of_birth" type="date" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="nationality">Nationality</Label>
            <Input id="nationality" name="nationality" defaultValue="Zambian" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="marital_status">Marital status</Label>
            <select id="marital_status" name="marital_status" className="mt-1 h-10 w-full rounded-md border border-ink-muted/20 bg-white px-3 text-sm">
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
            </select>
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Input id="gender" name="gender" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone" required>Mobile</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ''} required className="mt-1" />
            <FieldError message={state.fieldErrors?.phone} />
          </div>
          <div>
            <Label htmlFor="home_phone">Home phone</Label>
            <Input id="home_phone" name="home_phone" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="office_phone">Office phone</Label>
            <Input id="office_phone" name="office_phone" className="mt-1" />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={profile.email ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="next_of_kin_name">Next of kin</Label>
            <Input id="next_of_kin_name" name="next_of_kin_name" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="next_of_kin_phone">Next of kin phone</Label>
            <Input id="next_of_kin_phone" name="next_of_kin_phone" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="source_of_income">Source of income</Label>
            <Input id="source_of_income" name="source_of_income" className="mt-1" placeholder="Salary" />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="residential_address" required>Residential address</Label>
            <Input id="residential_address" name="residential_address" required className="mt-1" />
            <FieldError message={state.fieldErrors?.residential_address} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="postal_address">Postal address (if different)</Label>
            <Input id="postal_address" name="postal_address" className="mt-1" />
          </div>
        </CardContent>
        <CardFooter>
          <FieldError message={state.error} />
          <SubmitButton label="Save & continue" />
        </CardFooter>
      </form>
    </Card>
  );
}

function EmploymentStep({
  employee,
  employers,
  employerId,
  setEmployerId,
  basicPay,
  setBasicPay,
  allowances,
  setAllowances,
  onDone,
  onBack,
}: {
  employee: Tables<'employees'> | null;
  employers: EmployerLite[];
  employerId: string;
  setEmployerId: (id: string) => void;
  basicPay: number;
  setBasicPay: (n: number) => void;
  allowances: number;
  setAllowances: (n: number) => void;
  onDone: () => void;
  onBack: () => void;
}): React.ReactElement {
  const [state, action] = useFormState<FormState, FormData>(async (prev, fd) => {
    const r = await saveApplyEmployment(prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Employment</CardTitle>
          <CardDescription>Confirms which employer&apos;s scheme you&apos;re borrowing under.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="employer_id" required>Employer</Label>
            <select
              id="employer_id"
              name="employer_id"
              required
              value={employerId}
              onChange={(e) => setEmployerId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-ink-muted/20 bg-white px-3 text-sm"
            >
              {employers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.legal_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="employee_no" required>Employee number</Label>
            <Input id="employee_no" name="employee_no" defaultValue={employee?.employee_no ?? ''} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="employment_status">Employment status</Label>
            <select id="employment_status" name="employment_status" defaultValue={employee?.employment_status ?? 'permanent'} className="mt-1 h-10 w-full rounded-md border border-ink-muted/20 bg-white px-3 text-sm">
              <option value="permanent">Permanent</option>
              <option value="contract">Contract</option>
              <option value="temporal">Temporal</option>
            </select>
          </div>
          <div>
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" name="occupation" defaultValue={employee?.occupation ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={employee?.department ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="employment_start_date">Employment start</Label>
            <Input id="employment_start_date" name="employment_start_date" type="date" defaultValue={employee?.employment_start_date ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="salary_basic_zmw" required>Basic monthly salary (K)</Label>
            <Input id="salary_basic_zmw" name="salary_basic_zmw" type="number" step="0.01" min="0" required value={basicPay} onChange={(e) => setBasicPay(Number(e.target.value))} className="mt-1" />
            <FieldHelp>Drives NAPSA, NHIMA, and PAYE base.</FieldHelp>
          </div>
          <div>
            <Label htmlFor="salary_allowances_zmw">Allowances (K)</Label>
            <Input id="salary_allowances_zmw" name="salary_allowances_zmw" type="number" step="0.01" min="0" value={allowances} onChange={(e) => setAllowances(Number(e.target.value))} className="mt-1" />
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
            <FieldError message={state.error} />
          </div>
          <SubmitButton label="Save & continue" />
        </CardFooter>
      </form>
    </Card>
  );
}

function BankStep({
  employee,
  onDone,
  onBack,
}: {
  employee: Tables<'employees'> | null;
  onDone: () => void;
  onBack: () => void;
}): React.ReactElement {
  const [state, action] = useFormState<FormState, FormData>(async (prev, fd) => {
    const r = await saveApplyBank(prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Bank details</CardTitle>
          <CardDescription>Where the disbursed amount will land.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bank_name" required>Bank</Label>
            <Input id="bank_name" name="bank_name" defaultValue={employee?.bank_name ?? ''} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bank_branch">Branch</Label>
            <Input id="bank_branch" name="bank_branch" defaultValue={employee?.bank_branch ?? ''} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bank_account_type">Account type</Label>
            <Input id="bank_account_type" name="bank_account_type" defaultValue={employee?.bank_account_type ?? ''} placeholder="Current / Savings" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bank_account_no" required>Account number</Label>
            <Input id="bank_account_no" name="bank_account_no" defaultValue={employee?.bank_account_no ?? ''} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mobile_money_provider">Mobile money provider</Label>
            <Input id="mobile_money_provider" name="mobile_money_provider" placeholder="MTN / Airtel / Zamtel" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mobile_money_number">Mobile money number</Label>
            <Input id="mobile_money_number" name="mobile_money_number" className="mt-1" />
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
            <FieldError message={state.error} />
          </div>
          <SubmitButton label="Save & continue" />
        </CardFooter>
      </form>
    </Card>
  );
}

function DocumentsStep({
  applicationId,
  onDone,
  onBack,
}: {
  applicationId: string;
  onDone: () => void;
  onBack: () => void;
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Upload originals. PNG / JPG / PDF only. Up to 5 MB each.</CardDescription>
      </CardHeader>
      <CardContent>
        <DocumentUpload applicationId={applicationId} />
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onDone}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

function AmountStep({
  employer,
  requestedAmount,
  setRequestedAmount,
  tenure,
  setTenure,
  existingObligations,
  setExistingObligations,
  calc,
  onDone,
  onBack,
}: {
  employer: EmployerLite;
  requestedAmount: number;
  setRequestedAmount: (n: number) => void;
  tenure: number;
  setTenure: (n: number) => void;
  existingObligations: number;
  setExistingObligations: (n: number) => void;
  calc: ReturnType<typeof useMemo> extends infer T ? T : never;
  onDone: () => void;
  onBack: () => void;
}): React.ReactElement {
  const c = calc as null | {
    gross: number;
    napsa: number;
    nhima: number;
    paye: number;
    interest: { totalInterestZmw: number; totalCollectableZmw: number; monthlyInstallmentZmw: number };
    fees: { adminFeeZmw: number; insuranceFeeZmw: number; disbursedAmountZmw: number };
    aff: { netAfterStatutoryZmw: number; debtRatioPct: number | null; passes: boolean | null };
    monthlyRate: number;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan amount</CardTitle>
        <CardDescription>Numbers update live as you change inputs.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="requested_amount" required>Amount (K)</Label>
          <Input id="requested_amount" type="number" step="100" min="100" value={requestedAmount} onChange={(e) => setRequestedAmount(Number(e.target.value))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="tenure" required>Tenure (months)</Label>
          <Input id="tenure" type="number" step="1" min="1" max={employer.max_tenure_months ?? 12} value={tenure} onChange={(e) => setTenure(Number(e.target.value))} className="mt-1" />
          <FieldHelp>Max {employer.max_tenure_months} months for this employer.</FieldHelp>
        </div>
        <div>
          <Label htmlFor="existing">Existing monthly obligations (K)</Label>
          <Input id="existing" type="number" step="0.01" min="0" value={existingObligations} onChange={(e) => setExistingObligations(Number(e.target.value))} className="mt-1" />
          <FieldHelp>Other loans / advances already deducted from your salary.</FieldHelp>
        </div>
        <div className="sm:col-span-2 rounded-lg border border-ink-muted/10 bg-surface-base p-4 text-sm">
          {c ? (
            <dl className="grid grid-cols-2 gap-3">
              <Row label="Gross monthly pay" value={`K ${c.gross.toLocaleString('en-ZM')}`} />
              <Row label="Net after statutory" value={formatZmwNum(c.aff.netAfterStatutoryZmw)} />
              <Row label="PAYE" value={formatZmwNum(c.paye)} />
              <Row label="NAPSA" value={formatZmwNum(c.napsa)} />
              <Row label="NHIMA" value={formatZmwNum(c.nhima)} />
              <Row label="Monthly rate" value={`${(c.monthlyRate * 100).toFixed(2)}%`} />
              <Row label="Total interest" value={formatZmwNum(c.interest.totalInterestZmw)} />
              <Row label="Total collectable" value={formatZmwNum(c.interest.totalCollectableZmw)} />
              <Row label="Monthly instalment" value={formatZmwNum(c.interest.monthlyInstallmentZmw)} highlight />
              <Row label="Admin + insurance fees" value={formatZmwNum(c.fees.adminFeeZmw + c.fees.insuranceFeeZmw)} />
              <Row label="Cash you'll receive" value={formatZmwNum(c.fees.disbursedAmountZmw)} highlight />
              <Row
                label="Debt ratio"
                value={c.aff.debtRatioPct === null ? '—' : `${(c.aff.debtRatioPct * 100).toFixed(2)}%`}
                tone={c.aff.passes === false ? 'danger' : 'default'}
              />
            </dl>
          ) : null}
          {c?.aff.passes === false ? (
            <p className="mt-3 text-xs text-status-danger">
              Debt ratio exceeds your employer&apos;s cap. Try a lower amount or longer tenure.
            </p>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onDone} disabled={c?.aff.passes === false}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

function ReviewStep({
  employer,
  requestedAmount,
  tenure,
  existingObligations,
  calc,
  onBack,
}: {
  employer: EmployerLite;
  requestedAmount: number;
  tenure: number;
  existingObligations: number;
  calc: NonNullable<ReturnType<typeof useMemo>>;
  onBack: () => void;
}): React.ReactElement {
  const c = calc as {
    fees: { disbursedAmountZmw: number };
    interest: { monthlyInstallmentZmw: number; totalCollectableZmw: number };
  };
  const [state, action] = useFormState<FormState, FormData>(submitApplication, {});
  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Review &amp; submit</CardTitle>
          <CardDescription>
            Once submitted, your employer&apos;s HR will receive a request to countersign before
            Richmond Finance runs due diligence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink-base">
          <p>
            <strong>{employer.legal_name}</strong> — borrow{' '}
            <strong>K {requestedAmount.toLocaleString('en-ZM')}</strong> over{' '}
            <strong>{tenure} months</strong>.
          </p>
          <p>
            Monthly instalment <strong>{formatZmwNum(c.interest.monthlyInstallmentZmw)}</strong>; cash
            disbursed <strong>{formatZmwNum(c.fees.disbursedAmountZmw)}</strong>; total collectable{' '}
            <strong>{formatZmwNum(c.interest.totalCollectableZmw)}</strong>.
          </p>

          <input type="hidden" name="product" value="payroll_loan" />
          <input type="hidden" name="application_type" value="new_loan" />
          <input type="hidden" name="requested_amount_zmw" value={requestedAmount} />
          <input type="hidden" name="requested_tenure_months" value={tenure} />
          <input type="hidden" name="existing_obligations_zmw" value={existingObligations} />
          <input type="hidden" name="mode_of_payment" value="bank_transfer" />

          <label className="mt-2 flex items-start gap-2 text-xs text-ink-muted">
            <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-ink-muted/40" />
            I confirm the information I&apos;ve provided is accurate and authorise Richmond Finance to
            verify it (including credit-reference bureaus and my employer).
          </label>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
            <FieldError message={state.error} />
          </div>
          <SubmitButton label="Submit application" />
        </CardFooter>
      </form>
    </Card>
  );
}

function SubmitButton({ label }: { label: string }): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

function Row({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: 'default' | 'danger';
}): React.ReactElement {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd
        className={cn(
          'text-right text-ink-base',
          highlight && 'font-semibold',
          tone === 'danger' && 'text-status-danger',
        )}
      >
        {value}
      </dd>
    </>
  );
}

function formatZmwNum(n: number): string {
  return formatZmw(Math.round(n * 100));
}
