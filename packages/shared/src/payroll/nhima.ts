/**
 * NHIMA = 1% of basic pay (matches the xlsm `=D11*1%`), uncapped.
 * Operations confirmed basic, not gross, on 2026-05-12.
 */

export const NHIMA_RATE = 0.01;

export function computeNhimaMonthly(basicPayZmw: number): number {
  if (!Number.isFinite(basicPayZmw)) {
    throw new RangeError(`computeNhimaMonthly: basicPay must be finite (got ${basicPayZmw})`);
  }
  if (basicPayZmw <= 0) return 0;
  return Math.round(basicPayZmw * NHIMA_RATE * 100) / 100;
}
