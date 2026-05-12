/**
 * Role definitions and grouping used by sign-in role-selector UI.
 * The detailed enum (all 11 internal roles + CFO + employer + employee) is
 * defined in the Postgres profiles table and mirrored in /schemas in Phase 1.
 */

export type RoleGroupKey = 'staff' | 'employer' | 'employee';

export interface RoleGroup {
  key: RoleGroupKey;
  label: string;
  description: string;
}

export const ROLE_GROUPS: ReadonlyArray<RoleGroup> = [
  {
    key: 'staff',
    label: 'Richmond Finance staff',
    description: 'Branch CSE, approvers, accounts, CFO, master admin, auditor',
  },
  {
    key: 'employer',
    label: 'Employer HR',
    description: 'Confirm employment, countersign pre-approvals, upload deduction proofs',
  },
  {
    key: 'employee',
    label: 'Employee',
    description: 'Apply for a loan, sign contracts, view your statement',
  },
];
