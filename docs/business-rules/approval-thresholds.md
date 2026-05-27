# Approval thresholds

Locked on 2026-05-12. Every loan application moves through this state
machine once the employer has confirmed eligibility.

## Tiers

```
                     ┌─────────────────────────┐
                     │ Employee submits        │
                     │ status = `submitted`    │
                     └──────────┬──────────────┘
                                │
                                ▼
                     ┌─────────────────────────┐
                     │ Employer signatory      │
                     │ confirms employment +   │
                     │ signs pre-approval      │
                     │ status = `cse_review`   │
                     └──────────┬──────────────┘
                                │
                                ▼
                     ┌─────────────────────────┐
                     │ CSE due-diligence       │
                     │ checklist               │
                     └──────────┬──────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
   ≤ K5,000                K5,001 – K10,000          > K10,000
   (Tier L1)               (Tier L2)                 (Tier L3)
        │                       │                       │
        ▼                       ▼                       ▼
   approver_l1            approver_l1               approver_l1
        │                       ▼                       ▼
        │                  approver_l2               approver_l2
        │                       │                       ▼
        │                       │                  master_admin or CFO
        ▼                       ▼                       ▼
                     ┌─────────────────────────┐
                     │ status = `approved`     │
                     └──────────┬──────────────┘
                                ▼
                     ┌─────────────────────────┐
                     │ Borrower signs contract │
                     │ (PAdES-B-T seal)        │
                     │ status =                │
                     │ `pending_disbursement`  │
                     └──────────┬──────────────┘
                                ▼
                     ┌─────────────────────────┐
                     │ Accounts + CFO disburse │
                     │ status = `active`       │
                     └─────────────────────────┘
```

## Rules

- **No self-approval.** An approver cannot approve a request they
  originated, captured, or already approved at a lower tier. Enforced in
  RLS via `approvals.approver_id ≠ application.created_by` and
  `approvals.approver_id ≠ any(lower_tier_approver_ids)`.
- **Tier is derived from `requested_amount`** — not the `disbursed_amount`
  (which is lower after fees) and not the `total_collectable` (which is
  higher after interest).
- **A reject or request-info decision at any tier returns the
  application to CSE** with a `rejected` or `request_info` decision
  recorded; the employee is notified, and the application is not
  silently re-routed.
- **Disbursement requires both Accounts and CFO** regardless of tier.
  This is in addition to the tier sign-offs above.

## Salary advance (separate product)

- Always Tier L1 regardless of amount, capped at 3 months tenure.
- Disbursement still requires Accounts + CFO.
- No insurance fee charged (see `docs/business-rules/formulas.md §9`).
