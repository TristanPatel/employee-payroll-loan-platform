// Browser-side Supabase client. Lazy-singleton so client components reuse
// the same instance.

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@eplp/shared';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowser() {
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
