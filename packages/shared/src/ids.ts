/**
 * Identifier generators. Loan/application numbers use the format
 * `RFL{branchCode}{seq6}` where branchCode is 2 chars (e.g. LS/KT/ND) and
 * seq6 is a 6-digit zero-padded sequence allocated by Postgres SEQUENCE.
 * Pre-approval form serials use `RFS{seq7}` (matching the legacy xlsm).
 *
 * Sequence allocation is done in the DB; this module formats the resulting
 * components into a canonical string. Full implementation lands in Phase 2.
 */

export interface LoanNumberParts {
  branchCode: string;
  sequence: number;
}

export function formatLoanNumber(_parts: LoanNumberParts): string {
  throw new Error('Not implemented — Phase 2');
}

export interface PreApprovalSerialParts {
  sequence: number;
}

export function formatPreApprovalSerial(_parts: PreApprovalSerialParts): string {
  throw new Error('Not implemented — Phase 2');
}
