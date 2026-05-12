/**
 * Settlement / top-up calculator (mirrors the xlsm Settlement sheet).
 *
 *   recomputedTotalCollectable = principal × (1 + monthlyRate × tenureMonths)
 *   collectedSoFar             = sum of repayments through asOfDateIso
 *   graceInstalmentsToCollect  = instalments still due in the settlement
 *                                grace period (typically 1 month)
 *   settlementAmount           = recomputedTotalCollectable
 *                                - collectedSoFar
 *                                - graceInstalmentsToCollect × monthlyInstallment
 *
 * Settlement quote is valid for ~30 days; the validity window is set at
 * employer onboarding. Full implementation lands in Phase 2.
 */

export interface SettlementInputs {
  principalZmw: number;
  monthlyRate: number;
  tenureMonths: number;
  monthlyInstallmentZmw: number;
  collectedSoFarZmw: number;
  graceInstalmentCount: number;
}

export interface SettlementResult {
  recomputedTotalCollectableZmw: number;
  settlementAmountZmw: number;
  validUntilIso: string;
}

export function computeSettlement(_inputs: SettlementInputs): SettlementResult {
  throw new Error('Not implemented — Phase 2');
}
