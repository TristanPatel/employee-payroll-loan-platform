/**
 * Affordability model matching the Choppies/Sino loan generator workbook:
 *
 *   netAfterStatutory      = gross - (PAYE + NAPSA + NHIMA + union + pension)
 *   takeHomeRetained70pct  = netAfterStatutory × 0.70
 *   availableForObligs30pct= netAfterStatutory × 0.30   (cap on TOTAL obligations)
 *   maxRichmondDeduction   = availableForObligs30pct - existingObligations
 *   maxLoanPrincipal       = (tenureMonths × maxRichmondDeduction) / (1 + monthlyRate × tenureMonths)
 *   debtRatio              = (existingObligations + newRepayment) / netAfterStatutory
 *   passes                 = debtRatio <= employer.maxDebtRatioPct
 *
 * Default cap is 30%; employers can override (e.g. Choppies = 35%).
 * Full implementation + Vitest tests land in Phase 2.
 */

export interface AffordabilityInputs {
  grossPayZmw: number;
  basicPayZmw: number;
  payeZmw: number;
  napsaZmw: number;
  nhimaZmw: number;
  otherStatutoryZmw: number; // pension, union, persoanl-levy, etc.
  existingObligationsZmw: number;
  monthlyInterestRate: number;
  tenureMonths: number;
}

export interface AffordabilityResult {
  netAfterStatutoryZmw: number;
  takeHomeRetainedZmw: number;
  availableForObligationsZmw: number;
  maxRichmondDeductionZmw: number;
  maxLoanPrincipalZmw: number;
  debtRatioPct: number;
  passes: boolean;
}

export function computeAffordability(
  _inputs: AffordabilityInputs,
  _maxDebtRatioPct = 0.3,
): AffordabilityResult {
  throw new Error('Not implemented — Phase 2');
}
