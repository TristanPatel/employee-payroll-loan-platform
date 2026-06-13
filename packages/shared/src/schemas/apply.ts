/**
 * Zod schemas for the employee apply journey.
 *
 * Money fields use ZMW decimals on the form and are converted to ngwee
 * (integer) before insertion. NRC is normalised to remove whitespace.
 */

import { z } from 'zod';

const kwachaAsNgwee = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? Number(v.replace(/,/g, '')) : v))
  .refine((n) => Number.isFinite(n) && n >= 0, 'Must be 0 or more')
  .transform((n) => Math.round(n * 100));

const nrcSchema = z
  .string()
  .min(7, 'NRC required')
  .max(20)
  .transform((s) => s.replace(/\s+/g, '').trim());

const phoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^[0-9+\-\s]+$/, 'Digits, +, -, spaces only');

export const applyProfileSchema = z.object({
  salutation: z.enum(['mr', 'mrs', 'miss', 'dr', 'other']).optional(),
  first_name: z.string().min(1).max(80),
  middle_name: z.string().max(80).optional().or(z.literal('').transform(() => undefined)),
  surname: z.string().min(1).max(80),
  nrc_no: nrcSchema,
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().min(2).max(60).default('Zambian'),
  gender: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  marital_status: z.enum(['single', 'married']).optional(),
  phone: phoneSchema,
  home_phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  office_phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  next_of_kin_name: z
    .string()
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  next_of_kin_phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  residential_address: z.string().min(3).max(500),
  postal_address: z
    .string()
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  source_of_income: z
    .string()
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ApplyProfileInput = z.input<typeof applyProfileSchema>;
export type ApplyProfilePayload = z.output<typeof applyProfileSchema>;

export const applyEmploymentSchema = z.object({
  employer_id: z.string().uuid(),
  employee_no: z.string().min(1).max(40),
  occupation: z.string().max(120).optional().or(z.literal('').transform(() => undefined)),
  department: z.string().max(120).optional().or(z.literal('').transform(() => undefined)),
  employment_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  employment_status: z
    .enum(['permanent', 'contract', 'temporal', 'suspension', 'terminated'])
    .default('permanent'),
  salary_basic_zmw: kwachaAsNgwee,
  salary_allowances_zmw: kwachaAsNgwee.optional().default(0),
});

export type ApplyEmploymentInput = z.input<typeof applyEmploymentSchema>;
export type ApplyEmploymentPayload = z.output<typeof applyEmploymentSchema>;

export const applyBankSchema = z.object({
  bank_name: z.string().min(1).max(120),
  bank_branch: z.string().max(120).optional().or(z.literal('').transform(() => undefined)),
  bank_account_type: z.string().max(40).optional().or(z.literal('').transform(() => undefined)),
  bank_account_no: z.string().min(4).max(40),
  mobile_money_provider: z
    .string()
    .max(40)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  mobile_money_number: z
    .string()
    .max(20)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ApplyBankInput = z.input<typeof applyBankSchema>;
export type ApplyBankPayload = z.output<typeof applyBankSchema>;

export const applyLoanSchema = z.object({
  product: z.enum(['payroll_loan', 'salary_advance', 'top_up']).default('payroll_loan'),
  application_type: z.enum(['new_loan', 'refinancing']).default('new_loan'),
  refinancing_settlement_method: z.enum(['buyout', 'self_payment']).optional(),
  refinanced_from_loan_id: z.string().uuid().optional(),
  requested_amount_zmw: kwachaAsNgwee,
  requested_tenure_months: z.coerce.number().int().min(1).max(60),
  purpose: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
  mode_of_payment: z
    .enum(['bank_transfer', 'standing_order', 'mobile_money', 'employer_internal'])
    .default('bank_transfer'),
  existing_obligations_zmw: kwachaAsNgwee.optional().default(0),
  start_date_preferred: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ApplyLoanInput = z.input<typeof applyLoanSchema>;
export type ApplyLoanPayload = z.output<typeof applyLoanSchema>;

export const APPLY_DOCUMENT_TYPES = [
  'nrc_front',
  'nrc_back',
  'photo',
  'employment_contract',
  'payslip_1',
  'payslip_2',
  'payslip_3',
  'bank_proof',
  'residence_proof',
] as const;

export type ApplyDocumentType = (typeof APPLY_DOCUMENT_TYPES)[number];
