/**
 * Identifier formatters. The sequence number itself comes from a Postgres
 * SEQUENCE (see migration 13_sequences_and_audit) — these helpers only render
 * the canonical string.
 */

export interface LoanNumberParts {
  branchCode: string;
  sequence: number;
}

export function formatLoanNumber({ branchCode, sequence }: LoanNumberParts): string {
  if (!/^[A-Za-z]{2}$/.test(branchCode)) {
    throw new RangeError(`formatLoanNumber: branchCode must be exactly 2 letters (got "${branchCode}")`);
  }
  if (!Number.isInteger(sequence) || sequence <= 0 || sequence > 999_999) {
    throw new RangeError(`formatLoanNumber: sequence must be 1..999999 (got ${sequence})`);
  }
  return `RFL${branchCode.toUpperCase()}${sequence.toString().padStart(6, '0')}`;
}

export interface PreApprovalSerialParts {
  sequence: number;
}

export function formatPreApprovalSerial({ sequence }: PreApprovalSerialParts): string {
  if (!Number.isInteger(sequence) || sequence < 10_000 || sequence > 99_999) {
    throw new RangeError(`formatPreApprovalSerial: sequence must be 10000..99999 (got ${sequence})`);
  }
  return `RFS0${sequence.toString().padStart(5, '0')}`;
}
