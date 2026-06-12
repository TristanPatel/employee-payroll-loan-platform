'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateStaffAccess } from './actions';

interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface BranchOption {
  id: string;
  name: string;
  branch_code: string;
}

const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Master admin',
  branch_manager: 'Branch manager',
  cse: 'CSE',
  approver_l1: 'Approver L1',
  approver_l2: 'Approver L2',
  accounts: 'Accounts',
  cfo: 'CFO',
  auditor: 'Auditor',
  employer_admin: 'Employer admin',
  employer_signatory: 'Employer signatory',
  employee: 'Employee (borrower)',
};

export function StaffTable({
  rows,
  branches,
  selfId,
}: {
  rows: StaffRow[];
  branches: BranchOption[];
  selfId: string;
}): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
          <th className="px-6 py-3 font-medium">Person</th>
          <th className="px-6 py-3 font-medium">Role</th>
          <th className="px-6 py-3 font-medium">Branch</th>
          <th className="px-6 py-3 font-medium">Active</th>
          <th className="px-6 py-3 font-medium text-right">Save</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <StaffRowEditor key={r.id} row={r} branches={branches} isSelf={r.id === selfId} />
        ))}
      </tbody>
    </table>
  );
}

function StaffRowEditor({
  row,
  branches,
  isSelf,
}: {
  row: StaffRow;
  branches: BranchOption[];
  isSelf: boolean;
}): React.ReactElement {
  const [role, setRole] = useState(row.role);
  const [branchId, setBranchId] = useState(row.branch_id ?? '');
  const [isActive, setIsActive] = useState(row.is_active);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = role !== row.role || (branchId || null) !== row.branch_id || isActive !== row.is_active;

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('profile_id', row.id);
    fd.set('role', role);
    fd.set('branch_id', branchId);
    if (isActive) fd.set('is_active', 'on');
    startTransition(() => {
      void updateStaffAccess(undefined, fd).then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSaved(true);
      });
    });
  }

  return (
    <tr className="border-b border-ink-muted/5 last:border-0">
      <td className="px-6 py-3">
        <div className="font-medium text-ink-base">
          {row.full_name}
          {isSelf ? <span className="ml-2 text-xs text-ink-muted">(you)</span> : null}
        </div>
        <div className="text-xs text-ink-muted">{row.email ?? row.phone ?? '—'}</div>
      </td>
      <td className="px-6 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isSelf}
          className="h-9 rounded-md border border-ink-muted/20 bg-white px-2 text-sm disabled:opacity-60"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-9 rounded-md border border-ink-muted/20 bg-white px-2 text-sm"
        >
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.branch_code})
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isSelf}
          className="h-4 w-4 rounded border-ink-muted/40 disabled:opacity-60"
        />
      </td>
      <td className="px-6 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {error ? <span className="text-xs text-status-danger">{error}</span> : null}
          {saved && !dirty ? <CheckCircle2 className="h-4 w-4 text-status-success" /> : null}
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
