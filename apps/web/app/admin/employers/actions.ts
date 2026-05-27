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
