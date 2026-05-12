/**
 * NHIMA = 1% of basic pay (matches the xlsm `=D11*1%`), uncapped.
 * Full implementation lands in Phase 2.
 */

export const NHIMA_RATE = 0.01;

export function computeNhimaMonthly(_basicPayZmw: number): number {
  throw new Error('Not implemented — Phase 2');
}
