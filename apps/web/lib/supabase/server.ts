// Server-side Supabase client for App Router (RSC + server actions).
// Reads/writes cookies via `next/headers` so the session round-trips.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@eplp/shared';

export async function createSupabaseServer() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll may throw from a Server Component; the middleware refreshes
            // the session on every request so we can safely ignore.
          }
        },
      },
    },
  );
}
