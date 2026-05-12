/**
 * Approval thresholds (locked per the brief):
 *   L1: requestedAmount ≤ K5,000              → CSE + approver_l1
 *   L2: K5,001 ≤ requestedAmount ≤ K10,000    → approver_l1 + approver_l2
 *   L3: requestedAmount > K10,000             → approver_l1 + approver_l2 + master_admin/CFO
 *
 * Pre-employer-confirmation is always required before CSE due diligence
 * begins, regardless of tier.
 */

export type ApprovalTier = 'L1' | 'L2' | 'L3';

export const THRESHOLD_L1_MAX_ZMW = 5000;
export const THRESHOLD_L2_MAX_ZMW = 10000;

export function approvalTierFor(_requestedAmountZmw: number): ApprovalTier {
  throw new Error('Not implemented — Phase 2');
}

export function approversRequiredFor(_tier: ApprovalTier): ReadonlyArray<string> {
  throw new Error('Not implemented — Phase 2');
}
