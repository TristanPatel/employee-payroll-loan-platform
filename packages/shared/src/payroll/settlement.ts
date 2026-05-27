/**
 * Settlement / top-up calculator (mirrors the xlsm Settlement sheet).
 *
 *   recomputedTotalCollectable = principal × (1 + monthlyRate × tenureMonths)
 *   collectedSoFar             = sum of repayments through asOfDate
 *   graceInstalmentsToCollect  = instalments still due in grace (typically 1)
 *   settlementAmount           = recomputedTotalCollectable
 *                                − collectedSoFar
 *                                − graceInstalmentsToCollect × monthlyInstallment
 *
 * Settlement quote is valid for `validityDays` days from `asOfDateIso`.
 */

import { addMonthsAligned } from '../time';

export interface SettlementInputs {
  principalZmw: number;
  monthlyRate: number;
  tenureMonths: number;
  monthlyInstallmentZmw: number;
  collectedSoFarZmw: number;
  graceInstalmentCount: number;
  /** ISO YYYY-MM-DD date the quote is computed against (Lusaka local). */
  asOfDateIso: string;
  /** How many days the quote stays valid. */
  validityDays?: number;
}

export interface SettlementResult {
  recomputedTotalCollectableZmw: number;
  settlementAmountZmw: number;
  validUntilIso: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeSettlement(inputs: SettlementInputs): SettlementResult {
  const {
    principalZmw,
    monthlyRate,
    tenureMonths,
    monthlyInstallmentZmw,
    collectedSoFarZmw,
    graceInstalmentCount,
    asOfDateIso,
    validityDays = 30,
  } = inputs;

  if (!Number.isFinite(principalZmw) || principalZmw < 0) {
    throw new RangeError(`computeSettlement: principal must be >= 0 (got ${principalZmw})`);
  }
  if (!Number.isInteger(graceInstalmentCount) || graceInstalmentCount < 0) {
    throw new RangeError(
      `computeSettlement: graceInstalmentCount must be non-negative integer (got ${graceInstalmentCount})`,
    );
  }
  if (!Number.isInteger(validityDays) || validityDays < 0) {
    throw new RangeError(`computeSettlement: validityDays must be >= 0 (got ${validityDays})`);
  }
  if (collectedSoFarZmw < 0) {
    throw new RangeError(`computeSettlement: collectedSoFar must be >= 0 (got ${collectedSoFarZmw})`);
  }

  const recomputedTotalCollectable = principalZmw * (1 + monthlyRate * tenureMonths);
  const settlement =
    recomputedTotalCollectable -
    collectedSoFarZmw -
    graceInstalmentCount * monthlyInstallmentZmw;

  // Derive validity end-date by walking calendar days (28-day-safe path:
  // we just add days via Date arithmetic in UTC, then format).
  const parts = asOfDateIso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const validUntil = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + validityDays));
  const validUntilIso = `${validUntil.getUTCFullYear().toString().padStart(4, '0')}-${(
    validUntil.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, '0')}-${validUntil.getUTCDate().toString().padStart(2, '0')}`;

  return {
    recomputedTotalCollectableZmw: round2(recomputedTotalCollectable),
    settlementAmountZmw: round2(Math.max(0, settlement)),
    validUntilIso,
  };
}

// `addMonthsAligned` is imported for potential reuse by callers that want to
// derive grace-period end-dates. Keep this referenced so unused-import lint
// stays quiet.
export { addMonthsAligned };
