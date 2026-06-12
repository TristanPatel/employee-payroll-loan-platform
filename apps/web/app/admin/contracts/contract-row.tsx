'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regeneratePartA } from './actions';

export function ContractRow({
  contractId,
  status,
  hasDocument,
}: {
  contractId: string;
  status: string;
  hasDocument: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState<'seal' | 'regen' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seal() {
    setBusy('seal');
    setError(null);
    try {
      const res = await fetch(`/api/seal/${contractId}`, { method: 'POST' });
      const json = (await res.json()) as { error?: string; mode?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function regen() {
    setBusy('regen');
    setError(null);
    try {
      const r = await regeneratePartA(contractId);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const canRegen = !hasDocument && !['sealed', 'voided', 'expired'].includes(status);
  const canSeal = status === 'fully_signed' && hasDocument;

  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      {canRegen ? (
        <Button size="sm" variant="secondary" onClick={regen} disabled={busy !== null}>
          <FileText className="h-3 w-3" />
          {busy === 'regen' ? 'Regenerating…' : 'Regenerate Part A'}
        </Button>
      ) : null}
      {canSeal ? (
        <Button size="sm" onClick={seal} disabled={busy !== null}>
          <Lock className="h-3 w-3" />
          {busy === 'seal' ? 'Sealing…' : 'Seal'}
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
