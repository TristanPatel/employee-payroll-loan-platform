'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordAttestation } from './actions';

export function AttestRow({
  applicationId,
}: {
  applicationId: string;
}): React.ReactElement {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: 'confirmed' | 'declined') {
    setError(null);
    startTransition(() => {
      void recordAttestation(applicationId, decision, decision === 'declined' ? reason : undefined).then(
        (r) => {
          if (r.error) setError(r.error);
        },
      );
    });
  }

  if (declining) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className="h-9 w-48 rounded-md border border-ink-muted/20 bg-white px-2 text-xs"
        />
        <Button
          size="sm"
          variant="danger"
          disabled={pending || reason.trim().length === 0}
          onClick={() => submit('declined')}
        >
          {pending ? 'Saving…' : 'Confirm decline'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={pending}>
          Cancel
        </Button>
        {error ? <span className="text-xs text-status-danger">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => submit('confirmed')} disabled={pending}>
        <CheckCircle2 className="h-3 w-3" />
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setDeclining(true)} disabled={pending}>
        <XCircle className="h-3 w-3" />
        Decline
      </Button>
      {error ? <span className="text-xs text-status-danger">{error}</span> : null}
    </div>
  );
}
