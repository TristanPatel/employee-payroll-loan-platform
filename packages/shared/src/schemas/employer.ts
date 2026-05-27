/**
 * Zod schemas for the master_admin employer-onboarding flow.
 *
 * Money fields use ZMW decimals on the form and are converted to ngwee
 * (integer) before insertion. Rates are entered as percentages (0..100)
 * and stored as decimals (0..1).
 */

import { z } from 'zod';

const dayOfMonth = z
  .number()
  .int()
  .min(1, 'Day must be 1–28')
  .max(28, 'Day must be 1–28');

const pctAsPercentString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? Number(v) : v))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, 'Must be 0–100')
  .transform((n) => Math.round((n / 100) * 10_000) / 10_000); // 4-decimal precision

const kwachaAsNgwee = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? Number(v.replace(/,/g, '')) : v))
  .refine((n) => Number.isFinite(n) && n >= 0, 'Must be 0 or more')
  .transform((n) => Math.round(n * 100));

export const employerCreateSchema = z.object({
  legal_name: z.string().min(2, 'Legal name is required').max(200),
  trading_name: z.string().max(200).optional().or(z.literal('').transform(() => undefined)),
  registration_no: z.string().max(50).optional().or(z.literal('').transform(() => undefined)),
  tpin: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),

  mou_ref: z.string().max(100).optional().or(z.literal('').transform(() => undefined)),
  mou_signed_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  monthly_interest_rate_pct: pctAsPercentString,
  admin_fee_pct: pctAsPercentString,
  insurance_fee_pct: pctAsPercentString,
  max_debt_ratio_pct: pctAsPercentString,

  max_tenure_months: z.number().int().min(1).max(60),
  salary_advance_enabled: z.boolean().default(true),
  salary_advance_max_months: z.number().int().min(1).max(12).default(3),

  total_loan_pool_zmw: kwachaAsNgwee,

  payroll_run_day: dayOfMonth,
  deduction_cutoff_day: dayOfMonth,
  repayment_remittance_day: dayOfMonth,
  settlement_quote_validity_days: z.number().int().min(1).max(180).default(30),

  contact_address: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
  contact_phone: z.string().max(40).optional().or(z.literal('').transform(() => undefined)),
  contact_email: z
    .string()
    .email('Must be a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  notes: z.string().max(2000).optional().or(z.literal('').transform(() => undefined)),
});

export type EmployerCreateInput = z.input<typeof employerCreateSchema>;
export type EmployerCreatePayload = z.output<typeof employerCreateSchema>;

// Used by the UI to pre-fill the form with the same defaults as the DB.
export const employerFormDefaults = {
  legal_name: '',
  trading_name: '',
  registration_no: '',
  tpin: '',
  mou_ref: '',
  mou_signed_date: '',
  monthly_interest_rate_pct: 4,
  admin_fee_pct: 2,
  insurance_fee_pct: 2,
  max_debt_ratio_pct: 30,
  max_tenure_months: 12,
  salary_advance_enabled: true,
  salary_advance_max_months: 3,
  total_loan_pool_zmw: 0,
  payroll_run_day: 25,
  deduction_cutoff_day: 25,
  repayment_remittance_day: 7,
  settlement_quote_validity_days: 30,
  contact_address: '',
  contact_phone: '',
  contact_email: '',
  notes: '',
} satisfies EmployerCreateInput;

export const employerSignatoryCreateSchema = z.object({
  full_name: z.string().min(2).max(200),
  position: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(40).optional().or(z.literal('').transform(() => undefined)),
});

export type EmployerSignatoryCreateInput = z.input<typeof employerSignatoryCreateSchema>;
export type EmployerSignatoryCreatePayload = z.output<typeof employerSignatoryCreateSchema>;
