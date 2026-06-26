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
  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
    return { error: 'Missing application id — please restart the wizard.' };
  }
  const netPayZmwRaw = Number(formData.get('net_pay_zmw') ?? 0);
  const netPayZmw = Number.isFinite(netPayZmwRaw) && netPayZmwRaw > 0 ? netPayZmwRaw : 0;

  const supabase = await createSupabaseServer();
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, employer_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (empErr || !employee) return { error: 'Please complete the employment step first.' };

  // Confirm the draft exists and belongs to this borrower before we promote
  // it to 'submitted'. Phone confirmation is a SOFT gate: when the borrower
  // completes it, phone_confirmed_at is stamped (useful audit + proves the
  // number is live), but a missing stamp no longer blocks submission. This
  // keeps applications flowing if Twilio Verify isn't configured or the SMS
  // doesn't arrive; the CSE can still see whether the phone was confirmed.
  const { data: draft } = await supabase
    .from('loan_applications')
    .select('id, status, created_by, phone_confirmed_at')
    .eq('id', applicationId)
    .maybeSingle();
  if (!draft) return { error: 'Application draft was not found — please restart the wizard.' };
  if (draft.created_by !== profile.id) return { error: 'That application is not yours.' };
  if (draft.status !== 'draft') {
    return { error: `This application is already ${draft.status}; you can't re-submit it.` };
  }

  // Top-up / refinance guard: if a source loan is referenced, it must belong
  // to this borrower and still be collectable. Enforced server-side so a
  // tampered hidden field can't point the new application at someone else's
  // loan.
  if (p.refinanced_from_loan_id) {
    const { data: srcLoan } = await supabase
      .from('loans')
      .select('id, status, employee_id')
      .eq('id', p.refinanced_from_loan_id)
      .maybeSingle();
    if (!srcLoan || srcLoan.employee_id !== employee.id) {
      return { error: 'The loan you are refinancing was not found on your account.' };
    }
    if (!['active', 'in_arrears'].includes(srcLoan.status)) {
      return { error: `That loan is ${srcLoan.status} and can't be refinanced.` };
    }
  }

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

  const { data: app, error: updateErr } = await supabase
    .from('loan_applications')
    .update({
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
      net_pay_ngwee: Math.round(netPayZmw * 100),
      monthly_interest_rate: Number(employer.monthly_interest_rate),
      admin_fee_pct: Number(employer.admin_fee_pct),
      insurance_fee_pct: Number(employer.insurance_fee_pct),
      tier: tierEnum,
      status: 'submitted',
      application_no: appNoRow as unknown as string,
      submitted_at: new Date().toISOString(),
      start_date_preferred: p.start_date_preferred ?? null,
    })
    .eq('id', applicationId)
    .select('id')
    .single();
  if (updateErr || !app) return { error: updateErr?.message ?? 'Submit failed' };

  // Generate the Part A PDF via Edge Function (best-effort — failures don't
  // block the application submission; staff can re-trigger from /admin).
  let documentPath: string | null = null;
  let documentSha: string | null = null;
  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const accessToken = sessionRes.session?.access_token;
    if (accessToken) {
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-part-a`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ application_id: app.id }),
      });
      if (res.ok) {
        const out = (await res.json()) as { storage_path?: string; sha256?: string };
        documentPath = out.storage_path ?? null;
        documentSha = out.sha256 ?? null;
      }
    }
  } catch {
    // Swallowed — PDF generation can be re-run from staff side.
  }

  // Create the draft loan_agreement contract for the borrower to sign.
  // We override required_signatories to ['borrower','richmond_witness']
  // for Phase 4B/4C; employer_signatory signing is wired in Phase 5.
  const { data: template } = await supabase
    .from('contract_templates')
    .select('id, version')
    .eq('template_key', 'loan_agreement')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (template) {
    await supabase.from('contracts').insert({
      application_id: app.id,
      contract_type: 'loan_agreement',
      template_id: template.id,
      template_version: template.version,
      required_signatories: ['borrower', 'richmond_witness'],
      status: documentPath ? 'sent' : 'draft',
      document_storage_path: documentPath,
      document_sha256: documentSha,
      created_by: profile.id,
    });
  }

  revalidatePath('/portal');
  redirect(`/portal/my-application`);
}

/**
 * Idempotently create a draft loan_applications row keyed by the
 * wizard's client-generated UUID, so document uploads, phone-confirm
 * and payslip OCR can all reference an existing parent row via their
 * application_id FKs. submitApplication() then UPSERTs (status='submitted'
 * + application_no + submitted_at + final field values) the same row.
 *
 * Safe to call repeatedly — does nothing if the draft already exists.
 */
export async function ensureApplicationDraft(applicationId: string): Promise<FormState> {
  const profile = await requireRole(['employee']);
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return { error: 'Invalid application id.' };

  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from('loan_applications')
    .select('id, created_by')
    .eq('id', applicationId)
    .maybeSingle();
  if (existing) {
    if (existing.created_by && existing.created_by !== profile.id) {
      return { error: 'That application id is already taken.' };
    }
    return { ok: true };
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, employer_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!employee) return { error: 'Please complete the employment step first.' };

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('branch_code', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!branch) return { error: 'No active branch is configured.' };

  const { data: employer } = await supabase
    .from('employers')
    .select('monthly_interest_rate, admin_fee_pct, insurance_fee_pct')
    .eq('id', employee.employer_id)
    .maybeSingle();
  if (!employer) return { error: 'Employer not found.' };

  const { error } = await supabase
    .from('loan_applications')
    .insert({
      id: applicationId,
      employee_id: employee.id,
      employer_id: employee.employer_id,
      branch_id: branch.id,
      product: 'payroll_loan',
      application_type: 'new_loan',
      requested_amount_ngwee: 0,
      requested_tenure_months: 0,
      monthly_interest_rate: Number(employer.monthly_interest_rate),
      admin_fee_pct: Number(employer.admin_fee_pct),
      insurance_fee_pct: Number(employer.insurance_fee_pct),
      status: 'draft',
      created_by: profile.id,
    });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Returns the latest `ok` payslip OCR rows for the given application,
 * averaged into single basic/gross/net figures the apply wizard's Amount
 * step uses to pre-fill the borrower's salary inputs. Returns
 * `{ ok: false }` when fewer than three payslips have been read
 * successfully — the wizard then falls back to whatever the borrower
 * already typed (or the employees table value, if any).
 */
export async function getPayslipOcrSummary(applicationId: string): Promise<
  | { ok: false }
  | { ok: true; basicZmw: number; grossZmw: number; netZmw: number; samples: number }
> {
  await requireRole(['employee']);
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return { ok: false };

  const supabase = await createSupabaseServer();
  // For each of the three payslip slots, take the most recent ok row.
  const { data } = await supabase
    .from('application_payslip_ocr')
    .select('doc_type, gross_ngwee, basic_ngwee, net_ngwee, created_at, status')
    .eq('application_id', applicationId)
    .eq('status', 'ok')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) return { ok: false };

  const latestByType = new Map<string, typeof data[number]>();
  for (const r of data) {
    if (!latestByType.has(r.doc_type)) latestByType.set(r.doc_type, r);
  }
  const rows = ['payslip_1', 'payslip_2', 'payslip_3']
    .map((t) => latestByType.get(t))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (rows.length === 0) return { ok: false };

  const avg = (fn: (r: typeof rows[number]) => number | null): number => {
    const vs = rows.map(fn).filter((v): v is number => v != null && Number.isFinite(v));
    if (vs.length === 0) return 0;
    return vs.reduce((s, v) => s + v, 0) / vs.length / 100; // ngwee → ZMW
  };
  const basicZmw = avg((r) => Number(r.basic_ngwee));
  const grossZmw = avg((r) => Number(r.gross_ngwee));
  const netZmw = avg((r) => Number(r.net_ngwee));
  return { ok: true, basicZmw, grossZmw, netZmw, samples: rows.length };
}
