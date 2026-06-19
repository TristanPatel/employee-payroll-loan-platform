'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updateEmployerTerms, type FormState } from '../actions';

/**
 * Inline editor for the commercial + payroll terms surfaced on the
 * employer detail page. Read-only by default; click "Edit" to expand
 * the form. All numerics use percent-units for the UI (e.g. type "4"
 * for 4% interest); the action divides by 100 before writing.
 */
export function TermsForm({
  employerId,
  initial,
}: {
  employerId: string;
  initial: {
    monthly_interest_rate: number;       // decimal e.g. 0.04
    admin_fee_pct: number;
    insurance_fee_pct: number;
    max_debt_ratio_pct: number;
    max_tenure_months: number;
    salary_advance_enabled: boolean;
    salary_advance_max_months: number | null;
    total_loan_pool_ngwee: number;
    payroll_run_day: number;
    deduction_cutoff_day: number;
    repayment_remittance_day: number;
    settlement_quote_validity_days: number;
  };
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const pendingSinceRef = useRef(false);
  const [state, action] = useFormState<FormState, FormData>(
    (prev, fd) => updateEmployerTerms(employerId, prev, fd),
    {},
  );

  // Collapse the form on a clean save. useFormState updates `state` after
  // the action settles; we react to that here rather than awaiting the
  // returned promise (which is void on a server-action bound to action=).
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors && editing && pendingSinceRef.current) {
      setEditing(false);
      setJustSaved(true);
      pendingSinceRef.current = false;
    }
  }, [state, editing]);

  // Re-derive percentage strings from decimals for the input defaults.
  const pct = (v: number) => (v * 100).toString();
  const kwacha = (n: number) => Math.round(n / 100);

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        {justSaved ? <CheckCircle2 className="h-4 w-4 text-status-success" aria-label="Saved" /> : null}
        <Button type="button" size="sm" variant="secondary" onClick={() => { setEditing(true); setJustSaved(false); }}>
          Edit terms
        </Button>
      </span>
    );
  }

  return (
    <form
      action={(fd) => { pendingSinceRef.current = true; return action(fd); }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <NumField name="monthly_interest_rate_pct" label="Monthly interest (%)"
                step="0.01" defaultValue={pct(initial.monthly_interest_rate)}
                error={state.fieldErrors?.monthly_interest_rate_pct} required />
      <NumField name="admin_fee_pct"             label="Admin fee (%)"
                step="0.01" defaultValue={pct(initial.admin_fee_pct)}
                error={state.fieldErrors?.admin_fee_pct} required />
      <NumField name="insurance_fee_pct"         label="Insurance fee (%)"
                step="0.01" defaultValue={pct(initial.insurance_fee_pct)}
                error={state.fieldErrors?.insurance_fee_pct} required />
      <NumField name="max_debt_ratio_pct"        label="Max debt ratio (%)"
                step="0.5" defaultValue={pct(initial.max_debt_ratio_pct)}
                error={state.fieldErrors?.max_debt_ratio_pct} required />
      <NumField name="max_tenure_months"         label="Max tenure (months)"
                step="1" defaultValue={String(initial.max_tenure_months)}
                error={state.fieldErrors?.max_tenure_months} required />
      <NumField name="total_loan_pool_zmw"       label="Loan pool (K)"
                step="1000" defaultValue={String(kwacha(initial.total_loan_pool_ngwee))}
                error={state.fieldErrors?.total_loan_pool_zmw} required />
      <div className="sm:col-span-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-base">
          <input
            type="checkbox" name="salary_advance_enabled" defaultChecked={initial.salary_advance_enabled}
            className="h-4 w-4 rounded border-ink-muted/40"
          />
          Salary advance enabled
        </label>
        <div className="w-40">
          <Input
            name="salary_advance_max_months" type="number" min={1} max={12}
            defaultValue={initial.salary_advance_max_months ?? ''}
            placeholder="Advance max months"
            className="h-9"
          />
          <FieldError message={state.fieldErrors?.salary_advance_max_months} />
        </div>
      </div>
      <NumField name="payroll_run_day"               label="Payroll day"
                step="1" defaultValue={String(initial.payroll_run_day)}
                error={state.fieldErrors?.payroll_run_day} required />
      <NumField name="deduction_cutoff_day"          label="Deduction cut-off"
                step="1" defaultValue={String(initial.deduction_cutoff_day)}
                error={state.fieldErrors?.deduction_cutoff_day} required />
      <NumField name="repayment_remittance_day"      label="Remittance day"
                step="1" defaultValue={String(initial.repayment_remittance_day)}
                error={state.fieldErrors?.repayment_remittance_day} required />
      <NumField name="settlement_quote_validity_days" label="Settlement quote (days)"
                step="1" defaultValue={String(initial.settlement_quote_validity_days)}
                error={state.fieldErrors?.settlement_quote_validity_days} required />
      <div className="sm:col-span-3 flex items-center justify-between gap-3 pt-2">
        <div className="text-xs">
          <FieldError message={state.error} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs text-ink-muted hover:text-ink-base" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <SaveButton />
        </div>
      </div>
    </form>
  );
}

function NumField({
  name, label, step, defaultValue, required, error,
}: {
  name: string; label: string; step: string;
  defaultValue: string; required?: boolean; error?: string;
}): React.ReactElement {
  return (
    <div>
      <Label htmlFor={name} required={required}>{label}</Label>
      <Input id={name} name={name} type="number" step={step} required={required}
             defaultValue={defaultValue} className="mt-1 h-9" />
      <FieldError message={error} />
    </div>
  );
}

function SaveButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save terms'}
    </Button>
  );
}
