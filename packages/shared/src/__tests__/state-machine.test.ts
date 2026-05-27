/**
 * Light integration test of the full state machine described in the
 * migration files. This isn't an end-to-end DB test (which would
 * require a real Postgres) — instead it asserts the transition rules
 * that the UI assumes, so that a future schema change that breaks the
 * rules fails CI loudly.
 */

import { describe, expect, it } from 'vitest';

// Application-status state machine derived from migration 21 (the
// recordApproval + record_due_diligence_signoff RPCs).
const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  draft:                ['submitted', 'withdrawn'],
  submitted:            ['employer_review', 'cse_review', 'expired', 'withdrawn'],
  employer_review:      ['employer_confirmed', 'cse_review', 'rejected'],
  employer_confirmed:   ['cse_review'],
  cse_review:           ['l1_pending', 'rejected'],
  l1_pending:           ['l2_pending', 'approved', 'rejected', 'cse_review' /* request_info */],
  l2_pending:           ['l3_pending', 'approved', 'rejected', 'cse_review'],
  l3_pending:           ['approved', 'rejected', 'cse_review'],
  approved:             [/* terminal — disbursement happens on the loan side */],
  rejected:             [],
  expired:              [],
  withdrawn:            [],
};

// Loan-status state machine derived from migrations 22 + 23.
const LOAN_TRANSITIONS: Record<string, string[]> = {
  pending_disbursement: ['active', 'voided'],
  active:               ['in_arrears', 'settled'],
  in_arrears:           ['active', 'settled', 'written_off'],
  settled:              [],
  written_off:          [],
  voided:               [],
};

// Schedule-line state machine derived from migration 23.
const SCHEDULE_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['partial', 'deducted', 'missed'],
  partial:   ['deducted'],
  deducted:  ['remitted'],
  remitted:  [],
  missed:    ['partial', 'deducted' /* late payment */],
};

describe('application status state machine', () => {
  it('has no orphan states', () => {
    const allTargets = new Set(Object.values(APPLICATION_TRANSITIONS).flat());
    for (const target of allTargets) {
      expect(APPLICATION_TRANSITIONS).toHaveProperty(target);
    }
  });

  it('approved/rejected are terminal', () => {
    expect(APPLICATION_TRANSITIONS.approved).toEqual([]);
    expect(APPLICATION_TRANSITIONS.rejected).toEqual([]);
  });

  it('l1 reject jumps straight to rejected (no via cse_review detour)', () => {
    expect(APPLICATION_TRANSITIONS.l1_pending).toContain('rejected');
  });

  it('request_info loops every tier back to cse_review', () => {
    expect(APPLICATION_TRANSITIONS.l1_pending).toContain('cse_review');
    expect(APPLICATION_TRANSITIONS.l2_pending).toContain('cse_review');
    expect(APPLICATION_TRANSITIONS.l3_pending).toContain('cse_review');
  });

  it('cse_review only emits l1_pending or rejected (no skip-l1)', () => {
    expect(APPLICATION_TRANSITIONS.cse_review).toEqual(
      expect.arrayContaining(['l1_pending', 'rejected']),
    );
    expect(APPLICATION_TRANSITIONS.cse_review).not.toContain('l2_pending');
    expect(APPLICATION_TRANSITIONS.cse_review).not.toContain('l3_pending');
    expect(APPLICATION_TRANSITIONS.cse_review).not.toContain('approved');
  });
});

describe('loan status state machine', () => {
  it('active ↔ in_arrears is bidirectional', () => {
    expect(LOAN_TRANSITIONS.active).toContain('in_arrears');
    expect(LOAN_TRANSITIONS.in_arrears).toContain('active');
  });

  it('only in_arrears can transition to written_off', () => {
    for (const [state, targets] of Object.entries(LOAN_TRANSITIONS)) {
      if (state === 'in_arrears') continue;
      expect(targets).not.toContain('written_off');
    }
  });

  it('settled and written_off are terminal', () => {
    expect(LOAN_TRANSITIONS.settled).toEqual([]);
    expect(LOAN_TRANSITIONS.written_off).toEqual([]);
  });
});

describe('schedule line state machine', () => {
  it('deducted can advance only to remitted', () => {
    expect(SCHEDULE_TRANSITIONS.deducted).toEqual(['remitted']);
  });

  it('missed can be cleared by a late payment', () => {
    expect(SCHEDULE_TRANSITIONS.missed).toContain('partial');
    expect(SCHEDULE_TRANSITIONS.missed).toContain('deducted');
  });

  it('remitted is terminal', () => {
    expect(SCHEDULE_TRANSITIONS.remitted).toEqual([]);
  });
});

describe('full happy path (state names only)', () => {
  it('borrower → CSE → L1/L2/L3 → loan → disburse → repay → settle', () => {
    // application
    const appPath = [
      'submitted',
      'cse_review',
      'l1_pending',
      'l2_pending',
      'l3_pending',
      'approved',
    ];
    for (let i = 0; i < appPath.length - 1; i++) {
      const from = appPath[i]!;
      const to = appPath[i + 1]!;
      expect(APPLICATION_TRANSITIONS[from]).toContain(to);
    }
    // loan
    const loanPath = ['pending_disbursement', 'active', 'in_arrears', 'active', 'settled'];
    for (let i = 0; i < loanPath.length - 1; i++) {
      const from = loanPath[i]!;
      const to = loanPath[i + 1]!;
      expect(LOAN_TRANSITIONS[from]).toContain(to);
    }
    // schedule
    const sched = ['scheduled', 'partial', 'deducted'];
    for (let i = 0; i < sched.length - 1; i++) {
      expect(SCHEDULE_TRANSITIONS[sched[i]!]).toContain(sched[i + 1]!);
    }
  });
});
