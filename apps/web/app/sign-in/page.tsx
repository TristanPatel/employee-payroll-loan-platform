import Link from 'next/link';
import { ROLE_GROUPS, type RoleGroup } from '@eplp/shared';

export default function SignInPage(): React.ReactElement {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-base px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-richmond-primary text-base font-bold text-white">
            RF
          </div>
          <h1 className="text-2xl font-semibold text-ink-base">Employee Payroll Loan Portal</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in by selecting your role</p>
        </div>

        <div className="space-y-3 rounded-xl border border-ink-muted/10 bg-white p-6 shadow-sm">
          {ROLE_GROUPS.map((group) => (
            <RoleButton key={group.key} group={group} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Sign-in functionality is wired up in Phase 1 (Supabase Auth + MFA).
        </p>
        <p className="mt-1 text-center text-xs">
          <Link href="/" className="text-richmond-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

function RoleButton({ group }: { group: RoleGroup }): React.ReactElement {
  return (
    <button
      type="button"
      disabled
      className="flex w-full items-center justify-between rounded-lg border border-ink-muted/10 bg-surface-base px-4 py-3 text-left transition hover:border-richmond-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div>
        <div className="text-sm font-medium text-ink-base">{group.label}</div>
        <div className="text-xs text-ink-muted">{group.description}</div>
      </div>
      <span className="text-xs uppercase tracking-wide text-ink-muted">{group.key}</span>
    </button>
  );
}
