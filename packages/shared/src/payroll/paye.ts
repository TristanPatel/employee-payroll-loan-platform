/**
 * Zambia PAYE — marginal bands seeded from the live Choppies/Sino loan
 * generator workbook (`Loan_CommoditiesGenerator__Settlement.xlsm`,
 * Affordability v2.3 sheet, rows F19-F22):
 *
 *   0 – 4,500       0%
 *   4,501 – 4,800   25%   (next K300)
 *   4,801 – 6,900   30%   (next K2,099)
 *   > 6,900         37.5%
 *
 * In Phase 1 these bands move into a `tax_settings` table editable by
 * master_admin. The function here computes monthly PAYE given gross less
 * NAPSA (PAYE base) per the xlsm methodology.
 *
 * Full implementation + Vitest table-driven tests land in Phase 2.
 */

export interface PayeBand {
  readonly upTo: number | null; // null = open-ended top band
  readonly marginalRate: number; // 0-1
}

export const DEFAULT_PAYE_BANDS: ReadonlyArray<PayeBand> = [
  { upTo: 4500, marginalRate: 0 },
  { upTo: 4800, marginalRate: 0.25 },
  { upTo: 6900, marginalRate: 0.3 },
  { upTo: null, marginalRate: 0.375 },
];

export function computePayeMonthly(
  _payeBaseZmw: number,
  _bands: ReadonlyArray<PayeBand> = DEFAULT_PAYE_BANDS,
): number {
  throw new Error('Not implemented — Phase 2');
}
