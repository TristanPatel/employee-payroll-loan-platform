/**
 * Affordability model matching the Choppies/Sino loan generator workbook:
 *
 *   netAfterStatutory      = gross − (PAYE + NAPSA + NHIMA + union + pension)
 *   takeHomeRetained70pct  = netAfterStatutory × 0.70
 *   availableForObligs30pct= netAfterStatutory × 0.30   (cap on TOTAL obligations)
 *   maxRichmondDeduction   = availableForObligs30pct - existingObligations
 *   maxLoanPrincipal       = (tenureMonths × maxRichmondDeduction)
 *                            / (1 + monthlyRate × tenureMonths)
 *   newRepayment           = principal × (1 + monthlyRate × tenureMonths) / tenureMonths
 *   debtRatio              = (existingObligations + newRepayment) / netAfterStatutory
 *   passes                 = debtRatio <= maxDebtRatioPct
 *
 * Default maxDebtRatioPct is 0.30 (per-employer override; Choppies = 0.35).
 */

export interface AffordabilityInputs {
  grossPayZmw: number;
  basicPayZmw: number;
  payeZmw: number;
  napsaZmw: number;
  nhimaZmw: number;
  otherStatutoryZmw: number;
  existingObligationsZmw: number;
  monthlyInterestRate: number;
  tenureMonths: number;
  /** Proposed principal under evaluation. If omitted, only max-loan derivation runs. */
  proposedPrincipalZmw?: number;
}

export interface AffordabilityResult {
  netAfterStatutoryZmw: number;
  takeHomeRetainedZmw: number;
  availableForObligationsZmw: number;
  maxRichmondDeductionZmw: number;
  maxLoanPrincipalZmw: number;
  proposedRepaymentZmw: number | null;
  debtRatioPct: number | null;
  passes: boolean | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeAffordability(
  inputs: AffordabilityInputs,
  maxDebtRatioPct = 0.3,
): AffordabilityResult {
  const {
    grossPayZmw,
    payeZmw,
    napsaZmw,
    nhimaZmw,
    otherStatutoryZmw,
    existingObligationsZmw,
    monthlyInterestRate,
    tenureMonths,
    proposedPrincipalZmw,
  } = inputs;

  if (!Number.isFinite(grossPayZmw) || grossPayZmw < 0) {
    throw new RangeError(`computeAffordability: grossPay must be >= 0 (got ${grossPayZmw})`);
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new RangeError(`computeAffordability: tenureMonths must be positive (got ${tenureMonths})`);
  }

  const totalStatutory = payeZmw + napsaZmw + nhimaZmw + otherStatutoryZmw;
  const netAfterStatutory = grossPayZmw - totalStatutory;
  const takeHomeRetained = netAfterStatutory * 0.7;
  const availableForObligs = netAfterStatutory * 0.3;
  const maxRichmondDeduction = Math.max(0, availableForObligs - existingObligationsZmw);

  const factor = 1 + monthlyInterestRate * tenureMonths;
  const maxLoanPrincipal =
    factor === 0 ? 0 : (tenureMonths * maxRichmondDeduction) / factor;

  let proposedRepayment: number | null = null;
  let debtRatio: number | null = null;
  let passes: boolean | null = null;

  if (proposedPrincipalZmw !== undefined) {
    if (!Number.isFinite(proposedPrincipalZmw) || proposedPrincipalZmw < 0) {
      throw new RangeError(
        `computeAffordability: proposedPrincipal must be >= 0 (got ${proposedPrincipalZmw})`,
      );
    }
    proposedRepayment = (proposedPrincipalZmw * factor) / tenureMonths;
    debtRatio =
      netAfterStatutory <= 0
        ? Number.POSITIVE_INFINITY
        : (existingObligationsZmw + proposedRepayment) / netAfterStatutory;
    passes = debtRatio <= maxDebtRatioPct;
  }

  return {
    netAfterStatutoryZmw: round2(netAfterStatutory),
    takeHomeRetainedZmw: round2(takeHomeRetained),
    availableForObligationsZmw: round2(availableForObligs),
    maxRichmondDeductionZmw: round2(maxRichmondDeduction),
    maxLoanPrincipalZmw: round2(maxLoanPrincipal),
    proposedRepaymentZmw: proposedRepayment === null ? null : round2(proposedRepayment),
    debtRatioPct: debtRatio === null ? null : Math.round(debtRatio * 10_000) / 10_000,
    passes,
  };
}
