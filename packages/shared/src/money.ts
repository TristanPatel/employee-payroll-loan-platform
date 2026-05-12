/**
 * Money helpers. All amounts are stored as integer ngwee (1 K = 100 ngwee).
 * Display as "K 1,234.56". Never round mid-calculation in ZMW — round once
 * on conversion in/out.
 *
 * Full implementation + property-based tests land in Phase 2.
 */

export type Ngwee = number & { readonly __brand: 'ngwee' };

const NGWEE_PER_KWACHA = 100;

export function kwachaToNgwee(_kwacha: number): Ngwee {
  throw new Error('Not implemented — Phase 2');
}

export function ngweeToKwacha(_ngwee: Ngwee): number {
  throw new Error('Not implemented — Phase 2');
}

export function formatZmw(_ngwee: Ngwee): string {
  throw new Error('Not implemented — Phase 2');
}

export { NGWEE_PER_KWACHA };
