/**
 * Loan fees (one-off, deducted upfront from the disbursed amount).
 * Per-employer defaults are set at onboarding; the rates here are seed
 * defaults used by the application UI when an employer-specific value
 * isn't yet configured.
 *
 *   adminFee     = principal × employer.adminFeePct      (default 2%)
 *   insuranceFee = principal × employer.insuranceFeePct  (default 2%)
 *   disbursed    = principal - adminFee - insuranceFee - settlementPaid
 *
 * Full implementation lands in Phase 2.
 */

export const DEFAULT_ADMIN_FEE_PCT = 0.02;
export const DEFAULT_INSURANCE_FEE_PCT = 0.02;

export interface FeeInputs {
  principalZmw: number;
  adminFeePct: number;
  insuranceFeePct: number;
  settlementPaidZmw: number;
}

export interface FeeResult {
  adminFeeZmw: number;
  insuranceFeeZmw: number;
  disbursedAmountZmw: number;
}

export function computeFees(_inputs: FeeInputs): FeeResult {
  throw new Error('Not implemented — Phase 2');
}
