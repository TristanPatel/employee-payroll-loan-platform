/**
 * NAPSA contribution = 5% of basic pay, capped at the statutory monthly
 * ceiling (K1,540.20 per the 2025/2026 ceiling = 5% × K30,804).
 * The cap is stored in `tax_settings`; defaults are documented here.
 *
 * Full implementation lands in Phase 2.
 */

export const NAPSA_RATE = 0.05;
export const NAPSA_DEFAULT_CEILING_ZMW = 1540.2;

export function computeNapsaMonthly(
  _basicPayZmw: number,
  _ceilingZmw: number = NAPSA_DEFAULT_CEILING_ZMW,
): number {
  throw new Error('Not implemented — Phase 2');
}
