'use client';

import { useState, useTransition } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function RenderPdfButton({ batchId }: { batchId: string }): React.ReactElement {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fetchPdf() {
    setError(null);
    start(() => {
      void (async () => {
        try {
          const supabase = getSupabaseBrowser();
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;
          if (!token) {
            setError('Sign in expired');
            return;
          }
          const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/render-remittance-pdf`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            },
            body: JSON.stringify({ batch_id: batchId }),
          });
          if (!res.ok) {
            setError(`HTTP ${res.status}: ${await res.text()}`);
            return;
          }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank', 'noopener');
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={fetchPdf} disabled={pending}>
        <Download className="h-3 w-3" />
        {pending ? 'Generating…' : 'Download PDF'}
      </Button>
      {error ? <span className="text-xs text-status-danger">{error}</span> : null}
    </div>
  );
}
