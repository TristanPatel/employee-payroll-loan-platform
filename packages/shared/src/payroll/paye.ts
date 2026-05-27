/**
 * Zambia PAYE — marginal band calculation seeded from the live Choppies/Sino
 * loan generator workbook (Affordability v2.3, rows F19-F22).
 *
 *   0 – 4,500       0%
 *   4,501 – 4,800   25%   (next K300)
 *   4,801 – 6,900   30%   (next K2,099)
 *   > 6,900         37.5%
 *
 * Bands editable in the `tax_settings` table at runtime; the constants here
 * are pure-TS defaults used when no override is provided.
 */

export interface PayeBand {
  /** Upper bound (inclusive) of this band in ZMW, or `null` for the open-ended top band. */
  readonly upTo: number | null;
  /** Marginal rate (0..1). */
  readonly marginalRate: number;
}

export const DEFAULT_PAYE_BANDS: ReadonlyArray<PayeBand> = [
  { upTo: 4500, marginalRate: 0 },
  { upTo: 4800, marginalRate: 0.25 },
  { upTo: 6900, marginalRate: 0.3 },
  { upTo: null, marginalRate: 0.375 },
];

/**
 * Compute monthly PAYE in ZMW given the PAYE base (typically gross − NAPSA).
 * Returns a non-negative number rounded to two decimal places.
 */
export function computePayeMonthly(
  payeBaseZmw: number,
  bands: ReadonlyArray<PayeBand> = DEFAULT_PAYE_BANDS,
): number {
  if (!Number.isFinite(payeBaseZmw)) {
    throw new RangeError(`computePayeMonthly: payeBase must be finite (got ${payeBaseZmw})`);
  }
  if (payeBaseZmw <= 0) return 0;
  if (bands.length === 0) {
    throw new RangeError('computePayeMonthly: bands array must not be empty');
  }

  let tax = 0;
  let lowerBound = 0;

  for (const band of bands) {
    const upperBound = band.upTo ?? Number.POSITIVE_INFINITY;
    if (payeBaseZmw <= lowerBound) break;
    const taxableInBand = Math.min(payeBaseZmw, upperBound) - lowerBound;
    if (taxableInBand > 0) {
      tax += taxableInBand * band.marginalRate;
    }
    lowerBound = upperBound;
  }

  return Math.round(tax * 100) / 100;
}
