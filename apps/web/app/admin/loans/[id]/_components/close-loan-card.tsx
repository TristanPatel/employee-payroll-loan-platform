'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { formatZmw } from '@eplp/shared';
import { closeLoan } from '../../actions';

export function CloseLoanCard({
  loanId,
  outstandingNgwee,
  callerRole,
  status,
}: {
  loanId: string;
  outstandingNgwee: number;
  callerRole: string;
  status: string;
}): React.ReactElement | null {
  const [reason, setReason] = useState('');
  const [forceWriteOff, setForceWriteOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const fullyPaid = outstandingNgwee === 0;
  const canClose = (['accounts', 'cfo', 'master_admin'] as string[]).includes(callerRole);
  const canWriteOff = (['cfo', 'master_admin'] as string[]).includes(callerRole);
  const isClosable = (['active', 'in_arrears'] as string[]).includes(status);

  if (!canClose || !isClosable) return null;

  function submit() {
    setError(null);
    if (!reason.trim()) return setError('Closure reason required.');
    if (!fullyPaid && !forceWriteOff)
      return setError('Outstanding balance > 0; tick "force write-off" to proceed.');
    start(() => {
      void (async () => {
        const res = await closeLoan({
          loanId,
          reason: reason.trim(),
          forceWriteOff,
        });
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Close loan</CardTitle>
        <CardDescription>
          {fullyPaid
            ? 'Outstanding balance is K0 — close as settled.'
            : `Outstanding balance: ${formatZmw(outstandingNgwee)}. Force write-off requires CFO or master_admin.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="reason" required>Closure reason</Label>
          <Textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. fully paid via final salary deduction"
          />
        </div>
        {!fullyPaid && canWriteOff ? (
          <label className="flex items-center gap-2 text-xs text-ink-base">
            <input
              type="checkbox"
              checked={forceWriteOff}
              onChange={(e) => setForceWriteOff(e.target.checked)}
              className="h-4 w-4 rounded border-ink-muted/40"
            />
            Force write-off (loan_status becomes <code>written_off</code>)
          </label>
        ) : null}
        <FieldError message={error} />
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Closing…' : fullyPaid ? 'Mark settled' : 'Close loan'}
        </Button>
      </CardContent>
    </Card>
  );
}
