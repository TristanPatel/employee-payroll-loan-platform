'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Subscribes to Postgres row changes (RLS-scoped) and refreshes the current
 * server-rendered route when any watched table changes. This is what makes
 * the admin cockpit, employer queue, and borrower portal feel live: new
 * applications, signatures, attestations and notifications appear without a
 * manual reload.
 *
 * Refreshes are debounced so a burst of writes (e.g. a 12-row due-diligence
 * seed) triggers a single re-render.
 */
export function RealtimeRefresher({ tables }: { tables: string[] }): null {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase.channel(`refresh:${tables.join(',')}`);
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 400);
        },
      );
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')]);

  return null;
}
