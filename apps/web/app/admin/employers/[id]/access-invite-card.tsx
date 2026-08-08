'use client';

import { useState } from 'react';
import { KeyRound, Link2, RefreshCw, Copy, Check, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { inviteLink } from '@/lib/employer-entry';
import {
  rotateAccessCode,
  createEmployerInvite,
  revokeEmployerInvite,
} from '../actions';

export interface InviteRow {
  id: string;
  token: string;
  note: string | null;
  employee_no_hint: string | null;
  expires_at: string;
  accepted_at: string | null;
}

function CopyButton({ text }: { text: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Staff-only minting of the two confidential-entry credentials for one
 * employer: the poster access code (rotatable) and HR invite links (revocable).
 * Employer schemes are otherwise undiscoverable, so these are the only ways in.
 */
export function AccessInviteCard({
  employerId,
  accessCode,
  invites,
  portalOrigin,
}: {
  employerId: string;
  accessCode: string | null;
  invites: InviteRow[];
  portalOrigin: string;
}): React.ReactElement {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setPending(true);
    action()
      .then((res) => {
        if (res.error) setError(res.error);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setPending(false));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-richmond-primary" />
          Access &amp; invites
        </CardTitle>
        <CardDescription>
          How borrowers at this employer reach the scheme. Schemes are private — a borrower needs
          one of these to apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Access code */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Poster access code</div>
          <div className="mt-2 flex items-center gap-3">
            {accessCode ? (
              <code className="rounded-md bg-surface-muted px-3 py-1.5 text-lg font-semibold tracking-[0.25em] text-ink-base">
                {accessCode}
              </code>
            ) : (
              <span className="text-sm text-ink-muted">Not set — generate one to allow code entry.</span>
            )}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => rotateAccessCode(employerId))}
            >
              <RefreshCw className="h-4 w-4" />
              {accessCode ? 'Rotate' : 'Generate'}
            </Button>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Print it on the employer’s notice: “Go to {new URL(portalOrigin).host}/join and enter{' '}
            {accessCode ?? 'your code'}.” Rotating invalidates the old one.
          </p>
        </div>

        {/* Invite links */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">HR invite links</div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => createEmployerInvite(employerId))}
            >
              <Link2 className="h-4 w-4" />
              New link
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-ink-muted">No active invite links.</p>
            ) : (
              invites.map((inv) => {
                const url = inviteLink(portalOrigin, inv.token);
                const expired = new Date(inv.expires_at).getTime() < Date.now();
                return (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-muted/10 bg-surface-muted px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-ink-base">{url}</div>
                      <div className="text-[11px] text-ink-muted">
                        {inv.accepted_at
                          ? 'Accepted'
                          : expired
                            ? 'Expired'
                            : `Expires ${new Date(inv.expires_at).toLocaleDateString('en-ZM')}`}
                        {inv.note ? ` · ${inv.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CopyButton text={url} />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => revokeEmployerInvite(employerId, inv.id))}
                        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-red-600"
                      >
                        <Ban className="h-3 w-3" />
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
