'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, KeyRound, Mail, MoreHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmUser, sendPasswordResetEmail, setUserPassword } from './actions';

type Toast = { kind: 'ok' | 'err'; msg: string } | null;

/**
 * Per-row admin actions: confirm email, send password reset, set password.
 * Master_admin only; rules are enforced in the database, not in the UI.
 */
export function UserActions({
  profileId,
  fullName,
  isSelf,
}: {
  profileId: string;
  fullName: string;
  isSelf: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);
  const [pwMode, setPwMode] = useState(false);
  const [pw, setPw] = useState('');

  function announce(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }

  function runConfirm() {
    setOpen(false);
    startTransition(() => {
      void confirmUser(profileId).then((r) =>
        r.error
          ? announce({ kind: 'err', msg: r.error })
          : announce({ kind: 'ok', msg: `${fullName}: email confirmed.` }),
      );
    });
  }

  function runReset() {
    setOpen(false);
    startTransition(() => {
      void sendPasswordResetEmail(profileId).then((r) =>
        r.error
          ? announce({ kind: 'err', msg: r.error })
          : announce({ kind: 'ok', msg: `Reset email sent to ${fullName}.` }),
      );
    });
  }

  function runSetPassword() {
    if (pw.length < 12) {
      announce({ kind: 'err', msg: 'Password must be at least 12 characters.' });
      return;
    }
    startTransition(() => {
      void setUserPassword(profileId, pw).then((r) => {
        if (r.error) {
          announce({ kind: 'err', msg: r.error });
        } else {
          announce({ kind: 'ok', msg: `Password set for ${fullName}. Share it securely.` });
          setPwMode(false);
          setPw('');
        }
      });
    });
  }

  if (isSelf) return <span className="text-xs text-ink-muted">—</span>;

  if (pwMode) {
    return (
      <div className="flex items-center justify-end gap-2">
        <input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password (≥12 chars)"
          className="h-8 w-44 rounded-md border border-ink-muted/20 bg-white px-2 text-xs"
          autoFocus
        />
        <Button size="sm" onClick={runSetPassword} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink-base"
          onClick={() => {
            setPwMode(false);
            setPw('');
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-end gap-2">
      {toast ? (
        <span
          className={`max-w-[14rem] truncate text-xs ${
            toast.kind === 'ok' ? 'text-status-success' : 'text-status-danger'
          }`}
          title={toast.msg}
        >
          {toast.msg}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`User actions for ${fullName}`}
        className="inline-flex items-center gap-1 rounded-md border border-ink-muted/15 px-2 py-1 text-xs text-ink-muted hover:border-richmond-primary hover:text-richmond-primary"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
      >
        <MoreHorizontal className="h-4 w-4" />
        Manage
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-10 w-56 rounded-md border border-ink-muted/15 bg-white py-1 shadow-md"
          onMouseLeave={() => setOpen(false)}
        >
          <MenuItem icon={<ShieldCheck className="h-4 w-4" />} label="Confirm email" onClick={runConfirm} />
          <MenuItem icon={<Mail className="h-4 w-4" />} label="Send password reset" onClick={runReset} />
          <MenuItem
            icon={<KeyRound className="h-4 w-4" />}
            label="Set password manually"
            onClick={() => {
              setOpen(false);
              setPwMode(true);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-base hover:bg-surface-muted"
    >
      <span className="text-ink-muted">{icon}</span>
      {label}
    </button>
  );
}

// Re-export the success icon so the staff table can compose it next to the row.
export { CheckCircle2 };
