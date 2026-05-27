/**
 * Loan fees (one-off, deducted upfront from the disbursed amount).
 *
 * Per operations on 2026-05-12:
 *   • Admin fee + insurance fee are both flat percentages set per employer
 *     at onboarding (default 2% each).
 *   • Both fees apply to new loans AND to top-ups / refinancing facilities.
 *   • Insurance *coverage* only becomes effective after 6 successful monthly
 *     recoveries (see contract clause 7.1), but the *charge* is still
 *     deducted upfront — see docs/business-rules/formulas.md §4.
 *
 *   adminFee     = principal × adminFeePct
 *   insuranceFee = principal × insuranceFeePct
 *   disbursed    = principal − adminFee − insuranceFee − settlementPaid
 */

export const DEFAULT_ADMIN_FEE_PCT = 0.02;
export const DEFAULT_INSURANCE_FEE_PCT = 0.02;

export interface FeeInputs {
  principalZmw: number;
  adminFeePct: number;
  insuranceFeePct: number;
  settlementPaidZmw?: number;
}

export interface FeeResult {
  adminFeeZmw: number;
  insuranceFeeZmw: number;
  settlementPaidZmw: number;
  disbursedAmountZmw: number;
}

export function computeFees(inputs: FeeInputs): FeeResult {
  const { principalZmw, adminFeePct, insuranceFeePct } = inputs;
  const settlementPaidZmw = inputs.settlementPaidZmw ?? 0;
  if (!Number.isFinite(principalZmw) || principalZmw < 0) {
    throw new RangeError(`computeFees: principal must be >= 0 (got ${principalZmw})`);
  }
  if (!Number.isFinite(adminFeePct) || adminFeePct < 0 || adminFeePct > 1) {
    throw new RangeError(`computeFees: adminFeePct must be in [0,1] (got ${adminFeePct})`);
  }
  if (!Number.isFinite(insuranceFeePct) || insuranceFeePct < 0 || insuranceFeePct > 1) {
    throw new RangeError(`computeFees: insuranceFeePct must be in [0,1] (got ${insuranceFeePct})`);
  }
  if (!Number.isFinite(settlementPaidZmw) || settlementPaidZmw < 0) {
    throw new RangeError(`computeFees: settlementPaid must be >= 0 (got ${settlementPaidZmw})`);
  }
  const adminFee = Math.round(principalZmw * adminFeePct * 100) / 100;
  const insuranceFee = Math.round(principalZmw * insuranceFeePct * 100) / 100;
  const disbursed = principalZmw - adminFee - insuranceFee - settlementPaidZmw;
  if (disbursed < 0) {
    throw new RangeError(
      `computeFees: fees + settlement exceed principal (principal=${principalZmw}, ` +
        `admin=${adminFee}, insurance=${insuranceFee}, settlement=${settlementPaidZmw})`,
    );
  }
  return {
    adminFeeZmw: adminFee,
    insuranceFeeZmw: insuranceFee,
    settlementPaidZmw,
    disbursedAmountZmw: Math.round(disbursed * 100) / 100,
  };
}
