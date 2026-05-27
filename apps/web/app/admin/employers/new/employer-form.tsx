'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { employerFormDefaults } from '@eplp/shared';
import { createEmployer, type FormState } from '../actions';

export function EmployerForm(): React.ReactElement {
  const [state, action] = useFormState<FormState, FormData>(createEmployer, {});

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Legal name appears on every loan contract.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="legal_name" required>Legal name</Label>
            <Input id="legal_name" name="legal_name" defaultValue={employerFormDefaults.legal_name} required className="mt-1" />
            <FieldError message={state.fieldErrors?.legal_name} />
          </div>
          <div>
            <Label htmlFor="trading_name">Trading name</Label>
            <Input id="trading_name" name="trading_name" defaultValue={employerFormDefaults.trading_name} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="registration_no">Registration No.</Label>
            <Input id="registration_no" name="registration_no" defaultValue={employerFormDefaults.registration_no} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="tpin">TPIN</Label>
            <Input id="tpin" name="tpin" defaultValue={employerFormDefaults.tpin} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lending economics</CardTitle>
          <CardDescription>Per-employer rates set at onboarding; editable later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="monthly_interest_rate_pct" required>Monthly interest %</Label>
            <Input id="monthly_interest_rate_pct" name="monthly_interest_rate_pct" type="number" step="0.01" min="0" max="100" defaultValue={employerFormDefaults.monthly_interest_rate_pct} required className="mt-1" />
            <FieldHelp>Straight-line, e.g. 4 for 4%/month.</FieldHelp>
            <FieldError message={state.fieldErrors?.monthly_interest_rate_pct} />
          </div>
          <div>
            <Label htmlFor="admin_fee_pct" required>Admin fee %</Label>
            <Input id="admin_fee_pct" name="admin_fee_pct" type="number" step="0.01" min="0" max="100" defaultValue={employerFormDefaults.admin_fee_pct} required className="mt-1" />
            <FieldError message={state.fieldErrors?.admin_fee_pct} />
          </div>
          <div>
            <Label htmlFor="insurance_fee_pct" required>Insurance fee %</Label>
            <Input id="insurance_fee_pct" name="insurance_fee_pct" type="number" step="0.01" min="0" max="100" defaultValue={employerFormDefaults.insurance_fee_pct} required className="mt-1" />
            <FieldError message={state.fieldErrors?.insurance_fee_pct} />
          </div>
          <div>
            <Label htmlFor="max_debt_ratio_pct" required>Max debt ratio %</Label>
            <Input id="max_debt_ratio_pct" name="max_debt_ratio_pct" type="number" step="0.01" min="0" max="100" defaultValue={employerFormDefaults.max_debt_ratio_pct} required className="mt-1" />
            <FieldHelp>Reject if DSR exceeds. Choppies uses 35.</FieldHelp>
            <FieldError message={state.fieldErrors?.max_debt_ratio_pct} />
          </div>
          <div>
            <Label htmlFor="max_tenure_months" required>Max tenure (months)</Label>
            <Input id="max_tenure_months" name="max_tenure_months" type="number" step="1" min="1" max="60" defaultValue={employerFormDefaults.max_tenure_months} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="total_loan_pool_zmw" required>Loan pool (K)</Label>
            <Input id="total_loan_pool_zmw" name="total_loan_pool_zmw" type="number" step="0.01" min="0" defaultValue={employerFormDefaults.total_loan_pool_zmw} required className="mt-1" />
            <FieldHelp>Ceiling on aggregate active loans.</FieldHelp>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salary advance product</CardTitle>
          <CardDescription>Short-term advance, max 3 months, no insurance fee.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="salary_advance_enabled"
              defaultChecked={employerFormDefaults.salary_advance_enabled}
              className="h-4 w-4 rounded border-ink-muted/40 text-richmond-primary"
            />
            Salary advance enabled
          </label>
          <div>
            <Label htmlFor="salary_advance_max_months">Max advance tenure (months)</Label>
            <Input id="salary_advance_max_months" name="salary_advance_max_months" type="number" step="1" min="1" max="12" defaultValue={employerFormDefaults.salary_advance_max_months} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll cycle</CardTitle>
          <CardDescription>Days of the month that drive monthly deduction + remittance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="payroll_run_day" required>Payroll run day</Label>
            <Input id="payroll_run_day" name="payroll_run_day" type="number" step="1" min="1" max="28" defaultValue={employerFormDefaults.payroll_run_day} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="deduction_cutoff_day" required>Deduction cut-off day</Label>
            <Input id="deduction_cutoff_day" name="deduction_cutoff_day" type="number" step="1" min="1" max="28" defaultValue={employerFormDefaults.deduction_cutoff_day} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="repayment_remittance_day" required>Remittance day</Label>
            <Input id="repayment_remittance_day" name="repayment_remittance_day" type="number" step="1" min="1" max="28" defaultValue={employerFormDefaults.repayment_remittance_day} required className="mt-1" />
            <FieldHelp>Day funds must reach Richmond.</FieldHelp>
          </div>
          <div>
            <Label htmlFor="settlement_quote_validity_days">Settlement quote validity (days)</Label>
            <Input id="settlement_quote_validity_days" name="settlement_quote_validity_days" type="number" step="1" min="1" max="180" defaultValue={employerFormDefaults.settlement_quote_validity_days} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MOU</CardTitle>
          <CardDescription>Optional at this step; documents can be uploaded later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mou_ref">MOU reference</Label>
            <Input id="mou_ref" name="mou_ref" defaultValue={employerFormDefaults.mou_ref} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mou_signed_date">MOU signed date</Label>
            <Input id="mou_signed_date" name="mou_signed_date" type="date" defaultValue={employerFormDefaults.mou_signed_date} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="contact_address">Address</Label>
            <Input id="contact_address" name="contact_address" defaultValue={employerFormDefaults.contact_address} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="contact_phone">Phone</Label>
            <Input id="contact_phone" name="contact_phone" defaultValue={employerFormDefaults.contact_phone} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={employerFormDefaults.contact_email} className="mt-1" />
            <FieldError message={state.fieldErrors?.contact_email} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea id="notes" name="notes" defaultValue={employerFormDefaults.notes} className="mt-1" />
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <FieldError message={state.error} />
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Create employer'}
    </Button>
  );
}
