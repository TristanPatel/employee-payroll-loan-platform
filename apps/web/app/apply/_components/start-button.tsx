'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/label';
import { redeemEntry, type EntryState } from '../entry-actions';

function Submit(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Joining…' : 'Start application'}
    </Button>
  );
}

/**
 * Confirms entry to one employer and drops the borrower into the apply wizard.
 * The credential (invite token or access code) travels in a hidden field; the
 * action binds the profile and redirects, or returns an error to show inline
 * (e.g. already linked to a different employer).
 */
export function StartButton({
  token,
  code,
}: {
  token?: string;
  code?: string;
}): React.ReactElement {
  const [state, formAction] = useFormState<EntryState, FormData>(redeemEntry, {});
  return (
    <form action={formAction} className="space-y-3">
      {token ? <input type="hidden" name="token" value={token} /> : null}
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <Submit />
      <FieldError message={state.error ?? null} />
    </form>
  );
}
