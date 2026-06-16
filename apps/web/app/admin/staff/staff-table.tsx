'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteUser, updateStaffAccess } from './actions';
import { UserActions } from './user-actions';

interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  branch_id: string | null;
  employer_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface BranchOption {
  id: string;
  name: string;
  branch_code: string;
}

interface EmployerOption {
  id: string;
  legal_name: string;
}

// Staff-side roles only — borrowers (employee) are intentionally absent
// because they are managed through their applications, not this table.
// Setting a row to employee here would also remove it from this page (the
// list filters role='employee' out), making it look like a delete.
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
};

const EMPLOYER_ROLES = new Set(['employer_admin', 'employer_signatory']);

export function StaffTable({
  rows,
  branches,
  employers,
  selfId,
}: {
  rows: StaffRow[];
  branches: BranchOption[];
  employers: EmployerOption[];
  selfId: string;
}): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
          <th className="px-6 py-3 font-medium">Person</th>
          <th className="px-6 py-3 font-medium">Role</th>
          <th className="px-6 py-3 font-medium">Branch / Employer</th>
          <th className="px-6 py-3 font-medium">Active</th>
          <th className="px-6 py-3 font-medium text-right">Save</th>
          <th className="px-6 py-3 font-medium text-right">Manage</th>
          <th className="px-6 py-3 font-medium text-right">Delete</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <StaffRowEditor
            key={r.id}
            row={r}
            branches={branches}
            employers={employers}
            isSelf={r.id === selfId}
          />
        ))}
      </tbody>
    </table>
  );
}

function StaffRowEditor({
  row,
  branches,
  employers,
  isSelf,
}: {
  row: StaffRow;
  branches: BranchOption[];
  employers: EmployerOption[];
  isSelf: boolean;
}): React.ReactElement {
  const [role, setRole] = useState(row.role);
  const [branchId, setBranchId] = useState(row.branch_id ?? '');
  const [employerId, setEmployerId] = useState(row.employer_id ?? '');
  const [phone, setPhone] = useState(row.phone ?? '');
  const [isActive, setIsActive] = useState(row.is_active);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const isEmployerRole = EMPLOYER_ROLES.has(role);
  // Everyone except a borrower (employee) is staff-side and gets SMS alerts —
  // surface the phone requirement inline before they hit Save.
  const needsPhone = role !== 'employee';
  const dirty =
    role !== row.role ||
    (branchId || null) !== row.branch_id ||
    (employerId || null) !== row.employer_id ||
    phone.trim() !== (row.phone ?? '') ||
    isActive !== row.is_active;

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('profile_id', row.id);
    fd.set('role', role);
    fd.set('branch_id', branchId);
    fd.set('employer_id', employerId);
    fd.set('phone', phone.trim());
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

  function remove() {
    setError(null);
    startDelete(() => {
      void deleteUser(row.id).then((result) => {
        if (result.error) {
          setError(result.error);
          setConfirmDelete(false);
        }
        // On success the row disappears on revalidate.
      });
    });
  }

  return (
    <tr className="border-b border-ink-muted/5 last:border-0">
      <td className="px-6 py-3">
        <div className="font-medium text-ink-base">
          <Link href={`/admin/staff/${row.id}`} className="hover:text-richmond-primary hover:underline">
            {row.full_name}
          </Link>
          {isSelf ? <span className="ml-2 text-xs text-ink-muted">(you)</span> : null}
        </div>
        <div className="text-xs text-ink-muted">{row.email ?? '—'}</div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={needsPhone ? 'Mobile (required for alerts)' : 'Mobile (optional)'}
          className={`mt-1 h-8 w-44 rounded-md border bg-white px-2 text-xs ${
            needsPhone && phone.trim() === ''
              ? 'border-status-warning/60'
              : 'border-ink-muted/20'
          }`}
        />
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
        {isEmployerRole ? (
          <select
            value={employerId}
            onChange={(e) => setEmployerId(e.target.value)}
            className="h-9 rounded-md border border-ink-muted/20 bg-white px-2 text-sm"
          >
            <option value="">— pick employer —</option>
            {employers.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.legal_name}
              </option>
            ))}
          </select>
        ) : (
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
        )}
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
          <Button
            size="sm"
            onClick={save}
            disabled={!dirty || pending || (needsPhone && phone.trim() === '')}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </td>
      <td className="px-6 py-3 text-right">
        <UserActions profileId={row.id} fullName={row.full_name} isSelf={isSelf} />
      </td>
      <td className="px-6 py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-ink-muted">—</span>
        ) : confirmDelete ? (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm'}
            </Button>
            <button
              type="button"
              className="text-xs text-ink-muted hover:text-ink-base"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${row.full_name}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-status-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}
