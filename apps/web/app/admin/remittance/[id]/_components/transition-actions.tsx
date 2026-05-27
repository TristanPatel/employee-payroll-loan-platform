'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { ngweeToKwacha, kwachaToNgwee } from '@eplp/shared';
import { markSent, markReceived } from '../../actions';

export function TransitionActions({
  batchId,
  status,
  totalNgwee,
  canActAccounts,
}: {
  batchId: string;
  status: string;
  totalNgwee: number;
  canActAccounts: boolean;
}): React.ReactElement | null {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receivedKwacha, setReceivedKwacha] = useState(ngweeToKwacha(totalNgwee));
  const [bankRef, setBankRef] = useState('');

  if (!canActAccounts) return null;

  function send() {
    setError(null);
    start(() => {
      void (async () => {
        const res = await markSent(batchId);
        if (res.error) setError(res.error);
      })();
    });
  }

  function record() {
    setError(null);
    if (!bankRef.trim()) return setError('Bank reference required.');
    start(() => {
      void (async () => {
        const res = await markReceived({
          batchId,
          receivedNgwee: kwachaToNgwee(receivedKwacha),
          bankRef: bankRef.trim(),
        });
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <div className="flex w-72 flex-col gap-2 text-sm">
      {status === 'draft' ? (
        <Button onClick={send} disabled={pending}>
          {pending ? 'Sending…' : 'Mark sent to employer'}
        </Button>
      ) : null}
      {(['sent', 'partially_received'] as string[]).includes(status) ? (
        <div className="space-y-2 rounded-md border border-ink-muted/15 bg-white p-3">
          <div>
            <Label htmlFor="received">Received (ZMW)</Label>
            <Input
              id="received"
              type="number"
              value={receivedKwacha}
              onChange={(e) => setReceivedKwacha(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="bankref">Bank reference</Label>
            <Input id="bankref" value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
          </div>
          <Button onClick={record} disabled={pending}>
            {pending ? 'Recording…' : 'Record receipt'}
          </Button>
        </div>
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
