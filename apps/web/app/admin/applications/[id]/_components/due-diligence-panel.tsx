'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Circle, MinusCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setDueDiligenceState, signoffDueDiligence } from '../actions';

interface Check {
  id: string;
  item_key: string;
  phase: number;
  item_no: number;
  state: string;
  severity: string;
  note: string | null;
  checked_at: string | null;
}

interface Signoff {
  id: string;
  role_key: string;
  signed_at: string;
  profiles?: { full_name?: string } | null;
}

const LABEL: Record<string, string> = {
  nrc_validity_check: 'NRC validity & expiry',
  nrc_photo_match: 'NRC photo matches selfie',
  employment_letter_dated: 'Employment letter dated & signed',
  payslip_3mo_consistent: '3 months of payslips consistent',
  net_pay_meets_threshold: 'Net pay meets employer threshold',
  bank_statement_match: 'Bank statement matches payslip',
  existing_obligations_disclosed: 'All existing obligations disclosed',
  debt_ratio_within_limit: 'Debt-service ratio within limit',
  residence_proof_valid: 'Residence proof valid',
  employer_authorisation_signed: 'Employer authorisation signed',
  purpose_makes_sense: 'Loan purpose is reasonable',
  no_active_loans_in_arrears: 'No active loans in arrears',
};

export function DueDiligencePanel({
  applicationId,
  status,
  checks,
  signoffs,
  canEdit,
  canSignoffCse,
  canSignoffBranchManager,
}: {
  applicationId: string;
  status: string;
  checks: Check[];
  signoffs: Signoff[];
  canEdit: boolean;
  canSignoffCse: boolean;
  canSignoffBranchManager: boolean;
}): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(itemKey: string, state: 'pending' | 'pass' | 'fail' | 'na', note?: string) {
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await setDueDiligenceState({ applicationId, itemKey, state, note });
        if (res.error) setError(res.error);
      })();
    });
  }

  function signoff(roleKey: 'cse' | 'branch_manager') {
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await signoffDueDiligence({ applicationId, roleKey });
        if (res.error) setError(res.error);
      })();
    });
  }

  const passCount = checks.filter((c) => c.state === 'pass').length;
  const criticalFail = checks.filter((c) => c.severity === 'critical' && c.state !== 'pass').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Due-diligence checklist</CardTitle>
        <CardDescription>
          {passCount}/{checks.length} checks passed · {criticalFail} critical outstanding ·
          status <strong>{status}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((phase) => {
          const items = checks.filter((c) => c.phase === phase);
          if (items.length === 0) return null;
          return (
            <div key={phase}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Phase {phase}
              </p>
              <ul className="space-y-2">
                {items.map((c) => (
                  <CheckRow
                    key={c.id}
                    check={c}
                    canEdit={canEdit}
                    onChange={update}
                    pending={pending}
                  />
                ))}
              </ul>
            </div>
          );
        })}

        {error ? (
          <p className="rounded-md bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        ) : null}

        {/* Sign-offs */}
        <div className="border-t border-ink-muted/10 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Sign-offs
          </p>
          <ul className="space-y-1 text-sm">
            {(['cse', 'branch_manager'] as const).map((role) => {
              const so = signoffs.find((s) => s.role_key === role);
              return (
                <li key={role} className="flex items-center justify-between">
                  <span className="text-ink-base">
                    {role === 'cse' ? 'CSE' : 'Branch manager'} sign-off
                  </span>
                  {so ? (
                    <span className="text-xs text-status-success">
                      ✓ {so.profiles?.full_name ?? 'signed'}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">pending</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex gap-2">
            {canSignoffCse ? (
              <Button size="sm" onClick={() => signoff('cse')} disabled={pending || criticalFail > 0}>
                Sign as CSE
              </Button>
            ) : null}
            {canSignoffBranchManager ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => signoff('branch_manager')}
                disabled={pending || criticalFail > 0}
              >
                Sign as branch manager
              </Button>
            ) : null}
          </div>
          {criticalFail > 0 && (canSignoffCse || canSignoffBranchManager) ? (
            <p className="mt-2 text-xs text-ink-muted">
              All {criticalFail} critical checks must pass before sign-off.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CheckRow({
  check,
  canEdit,
  onChange,
  pending,
}: {
  check: Check;
  canEdit: boolean;
  onChange: (key: string, state: 'pending' | 'pass' | 'fail' | 'na', note?: string) => void;
  pending: boolean;
}): React.ReactElement {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(check.note ?? '');
  const label = LABEL[check.item_key] ?? check.item_key;

  return (
    <li className="rounded-md border border-ink-muted/10 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StateIcon state={check.state} />
          <div>
            <div className="text-sm text-ink-base">{label}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted">
              {check.severity} · phase {check.phase}.{check.item_no}
            </div>
          </div>
        </div>
        {canEdit ? (
          <div className="flex gap-1 text-xs">
            <StateButton current={check.state} target="pass" onClick={() => onChange(check.item_key, 'pass')} disabled={pending} />
            <StateButton current={check.state} target="fail" onClick={() => onChange(check.item_key, 'fail')} disabled={pending} />
            <StateButton current={check.state} target="na"   onClick={() => onChange(check.item_key, 'na')}   disabled={pending} />
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className="rounded px-2 py-0.5 text-ink-muted hover:text-richmond-primary"
            >
              {check.note ? 'note ✎' : 'note +'}
            </button>
          </div>
        ) : null}
      </div>
      {check.note && !noteOpen ? (
        <p className="mt-1 text-[11px] text-ink-muted">{check.note}</p>
      ) : null}
      {noteOpen ? (
        <div className="mt-2 flex gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observation…"
            className="flex-1"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onChange(check.item_key, check.state as 'pending' | 'pass' | 'fail' | 'na', note);
              setNoteOpen(false);
            }}
            disabled={pending}
          >
            Save
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function StateIcon({ state }: { state: string }): React.ReactElement {
  if (state === 'pass') return <CheckCircle2 className="h-4 w-4 text-status-success" />;
  if (state === 'fail') return <XCircle className="h-4 w-4 text-status-danger" />;
  if (state === 'na') return <MinusCircle className="h-4 w-4 text-ink-muted" />;
  return <Circle className="h-4 w-4 text-ink-muted" />;
}

function StateButton({
  current,
  target,
  onClick,
  disabled,
}: {
  current: string;
  target: 'pass' | 'fail' | 'na';
  onClick: () => void;
  disabled: boolean;
}): React.ReactElement {
  const active = current === target;
  const styles =
    target === 'pass'
      ? 'text-status-success'
      : target === 'fail'
        ? 'text-status-danger'
        : 'text-ink-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-0.5 ${active ? 'bg-surface-base font-semibold' : ''} ${styles} hover:bg-surface-base`}
    >
      {target}
    </button>
  );
}
