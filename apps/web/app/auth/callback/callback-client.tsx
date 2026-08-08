'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Consumes an implicit magic-link session that arrives in the URL hash
 * (#access_token=…). GoTrue's admin-generated magic links have no PKCE verifier,
 * so the tokens come back in the hash and are only picked up when the browser
 * Supabase client is instantiated on mount (detectSessionInUrl). Pages like
 * /join never mount that client, so the phone-signup magic link landed without a
 * session. This tiny page instantiates the client, waits for the session cookie
 * to be written, then hard-navigates to `next` so the destination re-renders
 * server-side as signed-in.
 */
export function AuthCallbackClient({ next }: { next: string }): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      // Hard navigation strips the hash and lets the server see the cookie.
      window.location.replace(next);
    };
    // If the session is already present (or once it lands), continue.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });
    // Fallback: if nothing arrives, don't hang forever.
    const t = setTimeout(() => {
      if (!done) setError('We couldn’t finish signing you in. Please try again.');
    }, 8000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [next]);

  return (
    <main className="grid min-h-screen place-items-center bg-surface-base px-6">
      <p className="text-sm text-ink-muted">{error ?? 'Signing you in…'}</p>
    </main>
  );
}
