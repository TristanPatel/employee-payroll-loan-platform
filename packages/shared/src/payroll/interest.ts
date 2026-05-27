/**
 * Straight-line (simple) interest:
 *   totalInterest      = principal × monthlyRate × tenureMonths
 *   totalCollectable   = principal + totalInterest
 *   monthlyInstallment = totalCollectable / tenureMonths
 *
 * Per-employer monthly rate is set at onboarding (e.g. Sino = 4%/mo,
 * settlement/top-up category = 2.25%/mo).
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

export function computeInterest(inputs: InterestInputs): InterestResult {
  const { principalZmw, monthlyRate, tenureMonths } = inputs;
  if (!Number.isFinite(principalZmw) || principalZmw < 0) {
    throw new RangeError(`computeInterest: principal must be >= 0 (got ${principalZmw})`);
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) {
    throw new RangeError(`computeInterest: monthlyRate must be >= 0 (got ${monthlyRate})`);
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new RangeError(`computeInterest: tenureMonths must be positive integer (got ${tenureMonths})`);
  }
  const totalInterest = principalZmw * monthlyRate * tenureMonths;
  const totalCollectable = principalZmw + totalInterest;
  const monthlyInstallment = totalCollectable / tenureMonths;
  return {
    totalInterestZmw: Math.round(totalInterest * 100) / 100,
    totalCollectableZmw: Math.round(totalCollectable * 100) / 100,
    monthlyInstallmentZmw: Math.round(monthlyInstallment * 100) / 100,
  };
}
