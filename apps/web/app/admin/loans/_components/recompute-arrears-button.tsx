'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { recomputeArrears } from '../actions';

export function RecomputeArrearsButton(): React.ReactElement {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function go() {
    setMsg(null);
    start(() => {
      void (async () => {
        const res = await recomputeArrears();
        if (res.error) setMsg(`Error: ${res.error}`);
        else setMsg(`Flagged ${res.missed ?? 0} loan(s) into arrears`);
      })();
    });
  }
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="secondary" onClick={go} disabled={pending}>
        {pending ? 'Scanning…' : 'Recompute arrears'}
      </Button>
      {msg ? <span className="text-xs text-ink-muted">{msg}</span> : null}
    </div>
  );
}
