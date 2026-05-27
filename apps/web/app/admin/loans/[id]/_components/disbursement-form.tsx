'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { formatZmw } from '@eplp/shared';
import { recordDisbursement } from '../actions';

export function DisbursementForm({
  loanId,
  disbursedAmount,
  authorisers,
}: {
  loanId: string;
  disbursedAmount: number;
  authorisers: { id: string; full_name: string; role: string }[];
}): React.ReactElement {
  const [method, setMethod] = useState<'bank_transfer' | 'mobile_money'>('bank_transfer');
  const [reference, setReference] = useState('');
  const [authorisedBy, setAuthorisedBy] = useState(authorisers[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (!reference.trim()) return setError('Reference (bank ref or txn id) is required.');
    if (!authorisedBy) return setError('Pick the authoriser (branch manager or CFO).');
    start(() => {
      void (async () => {
        const res = await recordDisbursement({
          loanId,
          method,
          reference: reference.trim(),
          authorisedById: authorisedBy,
        });
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record disbursement</CardTitle>
        <CardDescription>
          Net to borrower: <strong>{formatZmw(disbursedAmount)}</strong>. Maker-checker: pick an
          authoriser who is not yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Method</Label>
          <div className="mt-1 flex gap-2">
            {(['bank_transfer', 'mobile_money'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={
                  method === m
                    ? 'rounded-md bg-richmond-primary px-3 py-1.5 text-xs font-medium text-white'
                    : 'rounded-md border border-ink-muted/15 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-base'
                }
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="reference" required>Reference</Label>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. FNB-TXN-12345" />
        </div>
        <div>
          <Label htmlFor="authoriser" required>Authoriser</Label>
          <select
            id="authoriser"
            value={authorisedBy}
            onChange={(e) => setAuthorisedBy(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-muted/20 bg-white px-3 py-2 text-sm text-ink-base"
          >
            <option value="">— pick —</option>
            {authorisers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name} ({a.role.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
        </div>
        <FieldError message={error} />
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Recording…' : 'Record disbursement'}
        </Button>
      </CardContent>
    </Card>
  );
}
