'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  addEmployerDdOverride,
  deleteEmployerDdOverride,
  type FormState,
} from '../actions';

export interface DdOverrideRow {
  id: string;
  phase: number;
  item_no: number;
  item_key: string;
  description: string;
  severity: string;
  applies_to: ('new_loan' | 'refinancing')[];
  source_clause: string | null;
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical', major: 'Major', minor: 'Minor',
};
const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-status-danger/10 text-status-danger',
  major: 'bg-status-warning/10 text-status-warning',
  minor: 'bg-status-info/10 text-status-info',
};

export function DdOverridesList({
  employerId,
  rows,
}: {
  employerId: string;
  rows: DdOverrideRow[];
}): React.ReactElement {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="pb-2 font-medium">Phase / #</th>
                <th className="pb-2 font-medium">Check</th>
                <th className="pb-2 font-medium">Severity</th>
                <th className="pb-2 font-medium">Applies to</th>
                <th className="pb-2 font-medium">MOU</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-muted">
            No employer-specific checks yet. The standard 12-item due-diligence
            list applies. Use <strong>Add check</strong> to encode an MOU rule
            (e.g. minimum tenure, probation exclusion, top-up consent).
          </p>
        )}
      </div>

      {adding ? (
        <AddOverrideForm employerId={employerId} onDone={() => setAdding(false)} />
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3" />
          Add check
        </Button>
      )}
    </div>
  );
}

function Row({ row }: { row: DdOverrideRow }): React.ReactElement {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <tr className="border-t border-ink-muted/5 align-top">
      <td className="py-2 text-ink-muted">{row.phase}.{row.item_no}</td>
      <td className="py-2">
        <div className="font-medium text-ink-base">{row.item_key}</div>
        <div className="text-xs text-ink-muted">{row.description}</div>
      </td>
      <td className="py-2">
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[row.severity] ?? ''}`}>
          {SEVERITY_LABEL[row.severity] ?? row.severity}
        </span>
      </td>
      <td className="py-2 text-xs text-ink-muted">{row.applies_to.join(', ')}</td>
      <td className="py-2 text-xs text-ink-muted">{row.source_clause ?? '—'}</td>
      <td className="py-2 text-right">
        {err ? <span className="mr-2 text-xs text-status-danger">{err}</span> : null}
        {confirm ? (
          <span className="flex items-center justify-end gap-2">
            <Button
              size="sm" variant="danger" disabled={pending}
              onClick={() => {
                setErr(null);
                startTransition(() => {
                  void deleteEmployerDdOverride(row.id).then((res) => {
                    if (res.error) { setErr(res.error); setConfirm(false); }
                  });
                });
              }}>
              {pending ? 'Removing…' : 'Confirm'}
            </Button>
            <button type="button" className="text-xs text-ink-muted hover:text-ink-base"
                    onClick={() => setConfirm(false)} disabled={pending}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" aria-label={`Remove ${row.item_key}`}
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-status-danger"
                  onClick={() => setConfirm(true)}>
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
      </td>
    </tr>
  );
}

function AddOverrideForm({
  employerId,
  onDone,
}: {
  employerId: string;
  onDone: () => void;
}): React.ReactElement {
  const pendingSinceRef = useRef(false);
  const [state, action] = useFormState<FormState, FormData>(
    (prev, fd) => addEmployerDdOverride(employerId, prev, fd),
    {},
  );

  // Collapse on a clean save; same pattern as TermsForm.
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors && pendingSinceRef.current) {
      pendingSinceRef.current = false;
      onDone();
    }
  }, [state, onDone]);

  return (
    <form
      action={(fd) => { pendingSinceRef.current = true; return action(fd); }}
      className="space-y-3 rounded-md border border-ink-muted/10 bg-surface-base p-4"
    >
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <Label htmlFor="item_key" required>Item key</Label>
          <Input id="item_key" name="item_key" required
                 placeholder="choppies_min_tenure_3_months" className="mt-1 h-9" />
          <FieldHelp>Lowercase, underscore-separated; what the database row is keyed by.</FieldHelp>
          <FieldError message={state.fieldErrors?.item_key} />
        </div>
        <div className="sm:col-span-4">
          <Label htmlFor="description" required>Description</Label>
          <Input id="description" name="description" required
                 placeholder="Borrower has at least 3 consecutive months of service." className="mt-1 h-9" />
          <FieldError message={state.fieldErrors?.description} />
        </div>

        <div>
          <Label htmlFor="phase" required>Phase</Label>
          <Input id="phase" name="phase" type="number" min={1} max={9} defaultValue={4} required className="mt-1 h-9" />
          <FieldError message={state.fieldErrors?.phase} />
        </div>
        <div>
          <Label htmlFor="item_no" required>Item #</Label>
          <Input id="item_no" name="item_no" type="number" min={1} max={99} defaultValue={1} required className="mt-1 h-9" />
          <FieldError message={state.fieldErrors?.item_no} />
        </div>
        <div>
          <Label htmlFor="severity" required>Severity</Label>
          <select id="severity" name="severity" required defaultValue="critical"
                  className="mt-1 h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm">
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <FieldError message={state.fieldErrors?.severity} />
        </div>

        <div className="sm:col-span-3">
          <Label>Applies to</Label>
          <div className="mt-1 flex gap-4 text-sm text-ink-base">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="applies_new_loan" defaultChecked
                     className="h-4 w-4 rounded border-ink-muted/40" />
              New loan
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="applies_refinancing" defaultChecked
                     className="h-4 w-4 rounded border-ink-muted/40" />
              Refinancing / top-up
            </label>
          </div>
          <FieldError message={state.fieldErrors?.applies_to} />
        </div>

        <div className="sm:col-span-6">
          <Label htmlFor="source_clause">MOU reference</Label>
          <Input id="source_clause" name="source_clause"
                 placeholder="Choppies MOU §1.0" className="mt-1 h-9" />
          <FieldHelp>Optional — what an auditor needs to trace this check back to.</FieldHelp>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <FieldError message={state.error} />
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs text-ink-muted hover:text-ink-base" onClick={onDone}>
            Cancel
          </button>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Adding…' : 'Add check'}
    </Button>
  );
}
