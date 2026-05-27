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
export type StaffRole =
  | 'cse'
  | 'approver_l1'
  | 'approver_l2'
  | 'cfo'
  | 'master_admin';

export const THRESHOLD_L1_MAX_ZMW = 5000;
export const THRESHOLD_L2_MAX_ZMW = 10000;

export function approvalTierFor(requestedAmountZmw: number): ApprovalTier {
  if (!Number.isFinite(requestedAmountZmw) || requestedAmountZmw < 0) {
    throw new RangeError(`approvalTierFor: amount must be >= 0 (got ${requestedAmountZmw})`);
  }
  if (requestedAmountZmw <= THRESHOLD_L1_MAX_ZMW) return 'L1';
  if (requestedAmountZmw <= THRESHOLD_L2_MAX_ZMW) return 'L2';
  return 'L3';
}

const TIER_APPROVERS: Readonly<Record<ApprovalTier, ReadonlyArray<StaffRole>>> = {
  L1: ['cse', 'approver_l1'],
  L2: ['cse', 'approver_l1', 'approver_l2'],
  L3: ['cse', 'approver_l1', 'approver_l2', 'master_admin'],
};

export function approversRequiredFor(tier: ApprovalTier): ReadonlyArray<StaffRole> {
  return TIER_APPROVERS[tier];
}
