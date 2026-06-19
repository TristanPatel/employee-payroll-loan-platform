'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';
import {
  employerCreateSchema,
  employerSignatoryCreateSchema,
  type EmployerCreateInput,
  type EmployerSignatoryCreateInput,
} from '@eplp/shared';

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createEmployer(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  await requireMasterAdmin();

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k === 'salary_advance_enabled') {
      raw[k] = v === 'on' || v === 'true';
      continue;
    }
    if (
      [
        'max_tenure_months',
        'salary_advance_max_months',
        'payroll_run_day',
        'deduction_cutoff_day',
        'repayment_remittance_day',
        'settlement_quote_validity_days',
      ].includes(k)
    ) {
      raw[k] = Number(v);
      continue;
    }
    raw[k] = v;
  }
  // Checkbox absent from FormData when unchecked
  if (!('salary_advance_enabled' in raw)) raw.salary_advance_enabled = false;

  const parsed = employerCreateSchema.safeParse(raw as EmployerCreateInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string' && !fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const payload = parsed.data;
  const slug = payload.legal_name
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('employers')
    .insert({
      legal_name: payload.legal_name,
      slug,
      trading_name: payload.trading_name ?? null,
      registration_no: payload.registration_no ?? null,
      tpin: payload.tpin ?? null,
      mou_ref: payload.mou_ref ?? null,
      mou_signed_date: payload.mou_signed_date ?? null,
      monthly_interest_rate: payload.monthly_interest_rate_pct,
      admin_fee_pct: payload.admin_fee_pct,
      insurance_fee_pct: payload.insurance_fee_pct,
      max_debt_ratio_pct: payload.max_debt_ratio_pct,
      max_tenure_months: payload.max_tenure_months,
      salary_advance_enabled: payload.salary_advance_enabled,
      salary_advance_max_months: payload.salary_advance_max_months,
      total_loan_pool_ngwee: payload.total_loan_pool_zmw,
      payroll_run_day: payload.payroll_run_day,
      deduction_cutoff_day: payload.deduction_cutoff_day,
      repayment_remittance_day: payload.repayment_remittance_day,
      settlement_quote_validity_days: payload.settlement_quote_validity_days,
      contact_address: payload.contact_address ?? null,
      contact_phone: payload.contact_phone ?? null,
      contact_email: payload.contact_email ?? null,
      notes: payload.notes ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Insert failed' };
  }
  revalidatePath('/admin/employers');
  redirect(`/admin/employers/${data.id}`);
}

export async function addSignatory(
  employerId: string,
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  await requireMasterAdmin();

  const raw = {
    full_name: formData.get('full_name'),
    position: formData.get('position'),
    email: formData.get('email'),
    phone: formData.get('phone'),
  };
  const parsed = employerSignatoryCreateSchema.safeParse(raw as EmployerSignatoryCreateInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string' && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('employer_signatories').insert({
    employer_id: employerId,
    full_name: parsed.data.full_name,
    position: parsed.data.position,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/employers/${employerId}`);
  return {};
}

export async function archiveEmployer(employerId: string): Promise<FormState> {
  await requireMasterAdmin();
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('employers')
    .update({ status: 'archived', deleted_at: new Date().toISOString() })
    .eq('id', employerId);
  if (error) return { error: error.message };
  revalidatePath('/admin/employers');
  redirect('/admin/employers');
}

/**
 * Inline-edit of the per-employer commercial + payroll terms surfaced
 * on /admin/employers/[id]. Every value here is something an MOU can
 * vary; the dashboard exposes them so master_admin can adjust without
 * a code change. Numeric percentages are accepted as percent (e.g. 4
 * for 4%) to match the UI labels and stored as the 0.04 decimal the
 * rest of the system uses.
 */
export async function updateEmployerTerms(
  employerId: string,
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  await requireMasterAdmin();

  const num = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pct = (k: string) => {
    const n = num(k);
    return n == null ? null : n / 100;
  };
  const int = (k: string) => {
    const n = num(k);
    return n == null ? null : Math.round(n);
  };

  const monthlyInterest = pct('monthly_interest_rate_pct');
  const adminFee        = pct('admin_fee_pct');
  const insuranceFee    = pct('insurance_fee_pct');
  const maxDebtRatio    = pct('max_debt_ratio_pct');
  const maxTenure       = int('max_tenure_months');
  const salaryAdvOn     = formData.get('salary_advance_enabled') === 'on';
  const salaryAdvMax    = int('salary_advance_max_months');
  const totalPoolZmw    = num('total_loan_pool_zmw');
  const payrollRunDay   = int('payroll_run_day');
  const dedCutoffDay    = int('deduction_cutoff_day');
  const remitDay        = int('repayment_remittance_day');
  const settleValidity  = int('settlement_quote_validity_days');

  const errs: Record<string, string> = {};
  if (monthlyInterest == null || monthlyInterest < 0 || monthlyInterest > 0.5)
    errs.monthly_interest_rate_pct = 'Enter a monthly rate between 0 and 50.';
  if (adminFee == null || adminFee < 0 || adminFee > 0.2)
    errs.admin_fee_pct = 'Enter an admin fee between 0 and 20.';
  if (insuranceFee == null || insuranceFee < 0 || insuranceFee > 0.2)
    errs.insurance_fee_pct = 'Enter an insurance fee between 0 and 20.';
  if (maxDebtRatio == null || maxDebtRatio <= 0 || maxDebtRatio > 0.7)
    errs.max_debt_ratio_pct = 'Enter a debt ratio between 1 and 70.';
  if (maxTenure == null || maxTenure < 1 || maxTenure > 60)
    errs.max_tenure_months = 'Tenure must be between 1 and 60 months.';
  if (salaryAdvOn && (salaryAdvMax == null || salaryAdvMax < 1 || salaryAdvMax > 12))
    errs.salary_advance_max_months = 'Enter a value between 1 and 12.';
  if (totalPoolZmw == null || totalPoolZmw < 0)
    errs.total_loan_pool_zmw = 'Pool must be 0 or more (kwacha).';
  for (const [k, v] of Object.entries({
    payroll_run_day: payrollRunDay,
    deduction_cutoff_day: dedCutoffDay,
    repayment_remittance_day: remitDay,
  })) {
    if (v == null || v < 1 || v > 28) errs[k] = 'Must be a day-of-month between 1 and 28.';
  }
  if (settleValidity == null || settleValidity < 1 || settleValidity > 90)
    errs.settlement_quote_validity_days = 'Must be between 1 and 90 days.';
  if (Object.keys(errs).length) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: errs };
  }

  // Past validation: every required field is finite. The non-null assertion
  // here is a type assist, not a runtime claim — the errs gate already
  // returned for any null/NaN above. salary_advance_max_months is NOT NULL
  // in the DB with a default of 3, so when the advance is disabled we leave
  // the column untouched rather than try to null it.
  const supabase = await createSupabaseServer();
  const update = {
    monthly_interest_rate: monthlyInterest!,
    admin_fee_pct: adminFee!,
    insurance_fee_pct: insuranceFee!,
    max_debt_ratio_pct: maxDebtRatio!,
    max_tenure_months: maxTenure!,
    salary_advance_enabled: salaryAdvOn,
    total_loan_pool_ngwee: Math.round((totalPoolZmw ?? 0) * 100),
    payroll_run_day: payrollRunDay!,
    deduction_cutoff_day: dedCutoffDay!,
    repayment_remittance_day: remitDay!,
    settlement_quote_validity_days: settleValidity!,
    // salary_advance_max_months is NOT NULL in the DB with default 3; only
    // touch it when the advance is enabled so we don't try to write null
    // when the user disables advances.
    ...(salaryAdvOn && salaryAdvMax != null
      ? { salary_advance_max_months: salaryAdvMax }
      : {}),
  };
  const { error } = await supabase.from('employers').update(update).eq('id', employerId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/employers/${employerId}`);
  return {};
}

/**
 * CRUD over the per-employer DD-checklist overrides table (migration 41).
 * Each override is one extra check that seed_due_diligence() adds for
 * applications under this employer when the application_type matches
 * applies_to. master_admin only, to match the table's RLS.
 */
export async function addEmployerDdOverride(
  employerId: string,
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  await requireMasterAdmin();

  const itemKey      = String(formData.get('item_key') ?? '').trim();
  const description  = String(formData.get('description') ?? '').trim();
  const severity     = String(formData.get('severity') ?? 'critical');
  const phase        = Number(formData.get('phase') ?? 4);
  const itemNo       = Number(formData.get('item_no') ?? 1);
  const sourceClause = String(formData.get('source_clause') ?? '').trim() || null;
  const appliesNew   = formData.get('applies_new_loan') === 'on';
  const appliesRefi  = formData.get('applies_refinancing') === 'on';

  const errs: Record<string, string> = {};
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(itemKey))
    errs.item_key = 'Lowercase letters / digits / underscore, 3–64 chars, starting with a letter.';
  if (description.length < 10 || description.length > 500)
    errs.description = 'Describe the check in 10–500 characters.';
  if (!['critical', 'major', 'minor'].includes(severity))
    errs.severity = 'Pick critical / major / minor.';
  if (!Number.isFinite(phase) || phase < 1 || phase > 9)
    errs.phase = 'Phase between 1 and 9.';
  if (!Number.isFinite(itemNo) || itemNo < 1 || itemNo > 99)
    errs.item_no = 'Item number between 1 and 99.';
  if (!appliesNew && !appliesRefi)
    errs.applies_to = 'Pick at least one application type.';
  if (Object.keys(errs).length) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: errs };
  }

  const appliesTo: ('new_loan' | 'refinancing')[] = [];
  if (appliesNew) appliesTo.push('new_loan');
  if (appliesRefi) appliesTo.push('refinancing');

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('employer_dd_overrides').insert({
    employer_id: employerId,
    item_key: itemKey,
    description,
    severity,
    phase,
    item_no: itemNo,
    applies_to: appliesTo,
    source_clause: sourceClause,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/employers/${employerId}`);
  return {};
}

export async function deleteEmployerDdOverride(overrideId: string): Promise<FormState> {
  await requireMasterAdmin();
  const supabase = await createSupabaseServer();
  const { error, data } = await supabase
    .from('employer_dd_overrides')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', overrideId)
    .select('employer_id')
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.employer_id) revalidatePath(`/admin/employers/${data.employer_id}`);
  return {};
}
