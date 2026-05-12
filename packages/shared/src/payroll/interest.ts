/**
 * Straight-line (simple) interest:
 *   totalInterest      = principal × monthlyRate × tenureMonths
 *   totalCollectable   = principal + totalInterest
 *   monthlyInstallment = totalCollectable / tenureMonths
 *
 * Per-employer monthly rate is set at onboarding (e.g. Sino = 4%/mo,
 * settlement category = 2.25%/mo). Full implementation lands in Phase 2.
 */

export interface InterestInputs {
  principalZmw: number;
  monthlyRate: number;
  tenureMonths: number;
}

export interface InterestResult {
  totalInterestZmw: number;
  totalCollectableZmw: number;
  monthlyInstallmentZmw: number;
}

export function computeInterest(_inputs: InterestInputs): InterestResult {
  throw new Error('Not implemented — Phase 2');
}
