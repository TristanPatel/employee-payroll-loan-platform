'use client';

import { useState, useTransition } from 'react';
import { Label, FieldError } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { generateBatch } from '../actions';

export function GenerateBatchForm({
  employers,
}: {
  employers: { id: string; legal_name: string }[];
}): React.ReactElement {
  const now = new Date();
  const [employerId, setEmployerId] = useState(employers[0]?.id ?? '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (!employerId) return setError('Pick an employer.');
    start(() => {
      void (async () => {
        const res = await generateBatch({ employerId, year, month });
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <Label htmlFor="employer" required>Employer</Label>
        <select
          id="employer"
          value={employerId}
          onChange={(e) => setEmployerId(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink-muted/20 bg-white px-3 py-2 text-sm text-ink-base"
        >
          {employers.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.legal_name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="year" required>Year</Label>
        <input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-ink-muted/20 bg-white px-3 py-2 text-sm text-ink-base"
        />
      </div>
      <div>
        <Label htmlFor="month" required>Month</Label>
        <select
          id="month"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-ink-muted/20 bg-white px-3 py-2 text-sm text-ink-base"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-4 flex items-end justify-between">
        <FieldError message={error} />
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Generating…' : 'Generate batch'}
        </Button>
      </div>
    </div>
  );
}
