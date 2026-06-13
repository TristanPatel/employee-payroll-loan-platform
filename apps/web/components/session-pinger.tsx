'use client';

import { useEffect } from 'react';

/**
 * Fires a one-shot POST to /api/log-session when the page mounts. Mounted
 * inside the admin / portal / employer layouts after auth has succeeded.
 * The endpoint records nothing if there is no session; the middleware
 * cookie throttles this to one record per 10 minutes per user.
 */
export function SessionPinger({ kind, path }: { kind: string; path: string }): null {
  useEffect(() => {
    void fetch('/api/log-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, path }),
      keepalive: true,
    }).catch(() => {});
  }, [kind, path]);
  return null;
}
