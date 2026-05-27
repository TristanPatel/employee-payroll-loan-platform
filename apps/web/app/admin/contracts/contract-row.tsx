'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ContractRow({
  contractId,
  status,
}: {
  contractId: string;
  status: string;
}): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function seal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seal/${contractId}`, { method: 'POST' });
      const json = (await res.json()) as { error?: string; mode?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      {status === 'fully_signed' ? (
        <Button size="sm" onClick={seal} disabled={busy}>
          <Lock className="h-3 w-3" />
          {busy ? 'Sealing…' : 'Seal'}
        </Button>
      ) : null}
      {['sealed', 'fully_signed'].includes(status) ? (
        <Link href={`/api/evidence-export/${contractId}`} prefetch={false}>
          <Button size="sm" variant="secondary">
            <Download className="h-3 w-3" />
            Evidence
          </Button>
        </Link>
      ) : null}
      <Link href={`/verify/${contractId}`} className="text-ink-muted hover:text-richmond-primary">
        Verify ›
      </Link>
      {error ? <span className="ml-2 text-status-danger">{error}</span> : null}
    </div>
  );
}
