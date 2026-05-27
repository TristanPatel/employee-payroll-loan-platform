'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import {
  applyProfileSchema,
  applyEmploymentSchema,
  applyBankSchema,
  applyLoanSchema,
  approvalTierFor,
  ngweeToKwacha,
} from '@eplp/shared';

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

function collectFieldErrors(issues: Array<{ path: (string | number)[]; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path[0];
    if (typeof k === 'string' && !out[k]) out[k] = i.message;
  }
  return out;
}

export async function saveApplyProfile(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(['employee']);
  const raw = Object.fromEntries(formData.entries());
  const parsed = applyProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const p = parsed.data;
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      salutation: p.salutation ?? null,
      first_name: p.first_name,
      middle_name: p.middle_name ?? null,
      surname: p.surname,
      full_name: [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' '),
      nrc_no: p.nrc_no,
      phone: p.phone,
      home_phone: p.home_phone ?? null,
      office_phone: p.office_phone ?? null,
      email: p.email ?? null,
      next_of_kin_name: p.next_of_kin_name ?? null,
      next_of_kin_phone: p.next_of_kin_phone ?? null,
      source_of_income: p.source_of_income ?? null,
    })
    .eq('id', profile.id);
  if (error) return { error: error.message };
  revalidatePath('/portal/apply');
  return { ok: true };
}

export async function saveApplyEmployment(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(['employee']);
  const raw = Object.fromEntries(formData.entries());
  const parsed = applyEmploymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const p = parsed.data;
  const supabase = await createSupabaseServer();
  // Upsert the employees row keyed by profile_id.
  const { error } = await supabase
    .from('employees')
    .upsert(
      {
        profile_id: profile.id,
        employer_id: p.employer_id,
        employee_no: p.employee_no,
        occupation: p.occupation ?? null,
        department: p.department ?? null,
        employment_start_date: p.employment_start_date ?? null,
        employment_status: p.employment_status,
        salary_basic_ngwee: p.salary_basic_zmw,
        salary_allowances_ngwee: p.salary_allowances_zmw ?? 0,
      },
      { onConflict: 'profile_id' },
    );
  if (error) return { error: error.message };

  // Pin the profile to this employer too so RLS scopes work.
  await supabase.from('profiles').update({ employer_id: p.employer_id }).eq('id', profile.id);

  revalidatePath('/portal/apply');
  return { ok: true };
}

export async function saveApplyBank(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(['employee']);
  const raw = Object.fromEntries(formData.entries());
  const parsed = applyBankSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const p = parsed.data;
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('employees')
    .update({
      bank_name: p.bank_name,
      bank_branch: p.bank_branch ?? null,
      bank_account_type: p.bank_account_type ?? null,
      bank_account_no: p.bank_account_no,
      mobile_money_provider: p.mobile_money_provider ?? null,
      mobile_money_number: p.mobile_money_number ?? null,
    })
    .eq('profile_id', profile.id);
  if (error) return { error: error.message };
  revalidatePath('/portal/apply');
  return { ok: true };
}

export async function submitApplication(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(['employee']);
  const raw = Object.fromEntries(formData.entries());
  const parsed = applyLoanSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const p = parsed.data;

  const supabase = await createSupabaseServer();
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, employer_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (empErr || !employee) return { error: 'Please complete the employment step first.' };

  // Pick the first active branch as the routing branch; in Phase 5 the CSE
  // can re-assign. Falling back to the first branch ensures the FK satisfies.
  const { data: branch } = await supabase
    .from('branches')
    .select('id, branch_code')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('branch_code', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!branch) return { error: 'No active branch is configured. Contact Richmond Finance.' };

  // Snapshot lending economics from employer for reproducibility.
  const { data: employer } = await supabase
    .from('employers')
    .select('monthly_interest_rate, admin_fee_pct, insurance_fee_pct')
    .eq('id', employee.employer_id)
    .maybeSingle();
  if (!employer) return { error: 'Employer not found.' };

  const requestedKwacha = ngweeToKwacha(p.requested_amount_zmw);
  const tier = approvalTierFor(requestedKwacha);
  const tierEnum = tier.toLowerCase() as 'l1' | 'l2' | 'l3';

  // Allocate application number via the per-branch sequence helper.
  const { data: appNoRow, error: appNoErr } = await supabase.rpc('next_application_no', {
    branch_code: branch.branch_code,
  });
  if (appNoErr) return { error: appNoErr.message };

  const { data: app, error: insertErr } = await supabase
    .from('loan_applications')
    .insert({
      employee_id: employee.id,
      employer_id: employee.employer_id,
      branch_id: branch.id,
      product: p.product,
      application_type: p.application_type,
      refinancing_settlement_method: p.refinancing_settlement_method ?? null,
      refinanced_from_loan_id: p.refinanced_from_loan_id ?? null,
      requested_amount_ngwee: p.requested_amount_zmw,
      requested_tenure_months: p.requested_tenure_months,
      purpose: p.purpose ?? null,
      mode_of_payment: p.mode_of_payment,
      existing_obligations_ngwee: p.existing_obligations_zmw ?? 0,
      monthly_interest_rate: Number(employer.monthly_interest_rate),
      admin_fee_pct: Number(employer.admin_fee_pct),
      insurance_fee_pct: Number(employer.insurance_fee_pct),
      tier: tierEnum,
      status: 'submitted',
      application_no: appNoRow as unknown as string,
      submitted_at: new Date().toISOString(),
      start_date_preferred: p.start_date_preferred ?? null,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (insertErr || !app) return { error: insertErr?.message ?? 'Insert failed' };

  revalidatePath('/portal');
  redirect(`/portal/my-application`);
}
