/**
 * Money helpers. All amounts are stored as integer ngwee (1 K = 100 ngwee).
 * Display as "K 1,234.56". Never round mid-calculation in ZMW — round once
 * on conversion in/out.
 */

export type Ngwee = number & { readonly __brand: 'ngwee' };

export const NGWEE_PER_KWACHA = 100;

const FORMATTER = new Intl.NumberFormat('en-ZM', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function asNgwee(n: number): Ngwee {
  return n as Ngwee;
}

/** Convert ZMW Kwacha (decimal) to integer ngwee, rounded half-up. */
export function kwachaToNgwee(kwacha: number): Ngwee {
  if (!Number.isFinite(kwacha)) {
    throw new RangeError(`kwachaToNgwee: input must be finite (got ${kwacha})`);
  }
  return asNgwee(Math.round(kwacha * NGWEE_PER_KWACHA));
}

/** Convert integer ngwee back to a decimal ZMW value (exact). */
export function ngweeToKwacha(ngwee: Ngwee | number): number {
  return Number(ngwee) / NGWEE_PER_KWACHA;
}

/** Format ngwee as `K 1,234.56` per Richmond display convention. */
export function formatZmw(ngwee: Ngwee | number): string {
  return `K ${FORMATTER.format(ngweeToKwacha(ngwee))}`;
}

/** Round a number to integer ngwee (half-up). Used inside ratio formulas. */
export function roundNgwee(n: number): Ngwee {
  return asNgwee(Math.round(n));
}
