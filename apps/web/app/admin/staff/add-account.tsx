'use client';

import { useState, useTransition } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createAccount } from './actions';

interface BranchOption {
  id: string;
  name: string;
  branch_code: string;
}
interface EmployerOption {
  id: string;
  legal_name: string;
}

const ROLE_OPTIONS: Array<[string, string]> = [
  ['branch_manager', 'Branch manager'],
  ['cse', 'CSE'],
  ['approver_l1', 'Approver L1'],
  ['approver_l2', 'Approver L2'],
  ['accounts', 'Accounts'],
  ['cfo', 'CFO'],
  ['auditor', 'Auditor'],
  ['master_admin', 'Master admin'],
  ['employer_admin', 'Employer admin'],
  ['employer_signatory', 'Employer signatory'],
];

const EMPLOYER_ROLES = new Set(['employer_admin', 'employer_signatory']);

export function AddAccount({
  branches,
  employers,
}: {
  branches: BranchOption[];
  employers: EmployerOption[];
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('cse');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isEmployerRole = EMPLOYER_ROLES.has(role);

  function submit(form: HTMLFormElement) {
    setError(null);
    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '');
    startTransition(() => {
      void createAccount(fd).then((r) => {
        if (r.error) {
          setError(r.error);
          return;
        }
        setCreated({ email, password: r.tempPassword ?? '' });
        form.reset();
        setRole('cse');
      });
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Add account
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-ink-muted/15 bg-white p-4">
      {created ? (
        <div className="space-y-2 rounded-md bg-status-success/5 p-3 text-sm">
          <div className="font-medium text-status-success">Account created for {created.email}</div>
          <div className="text-ink-base">
            Temporary password:{' '}
            <code className="rounded bg-surface-muted px-2 py-0.5 font-mono">{created.password}</code>
          </div>
          <p className="text-xs text-ink-muted">
            Share this securely. They sign in with it via the &ldquo;Use a password&rdquo; option,
            then can switch to email codes. You can also send a reset from their Manage menu.
          </p>
          <button
            type="button"
            className="text-xs font-medium text-richmond-primary hover:underline"
            onClick={() => setCreated(null)}
          >
            Add another
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="text-xs text-ink-muted">
            Full name
            <input name="full_name" required className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm" />
          </label>
          <label className="text-xs text-ink-muted">
            Email
            <input name="email" type="email" required className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm" />
          </label>
          <label className="text-xs text-ink-muted">
            Role
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm"
            >
              {ROLE_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Mobile {role !== 'employee' ? '(required)' : ''}
            <input name="phone" type="tel" className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm" />
          </label>
          {isEmployerRole ? (
            <label className="text-xs text-ink-muted sm:col-span-2">
              Employer
              <select name="employer_id" className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm">
                <option value="">— pick employer —</option>
                {employers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.legal_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-xs text-ink-muted sm:col-span-2">
              Branch (optional)
              <select name="branch_id" className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm">
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branch_code})
                  </option>
                ))}
              </select>
            </label>
          )}
          {error ? <div className="text-xs text-status-danger sm:col-span-2">{error}</div> : null}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create account'}
            </Button>
            <button
              type="button"
              className="text-xs text-ink-muted hover:text-ink-base"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
