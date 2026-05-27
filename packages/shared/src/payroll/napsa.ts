/**
 * NAPSA contribution = 5% of basic pay, capped at the monthly statutory
 * ceiling (K1,540.20 for 2025/2026 = 5% × K30,804).
 */

export const NAPSA_RATE = 0.05;
export const NAPSA_DEFAULT_CEILING_ZMW = 1540.2;

export function computeNapsaMonthly(
  basicPayZmw: number,
  ceilingZmw: number = NAPSA_DEFAULT_CEILING_ZMW,
): number {
  if (!Number.isFinite(basicPayZmw)) {
    throw new RangeError(`computeNapsaMonthly: basicPay must be finite (got ${basicPayZmw})`);
  }
  if (basicPayZmw <= 0) return 0;
  const raw = basicPayZmw * NAPSA_RATE;
  const capped = Math.min(raw, ceilingZmw);
  return Math.round(capped * 100) / 100;
}
