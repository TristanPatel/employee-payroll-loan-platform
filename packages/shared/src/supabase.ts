/**
 * Strongly-typed Supabase client factories.
 *
 * Web/mobile/edge callers each import the right factory. The Database type is
 * regenerated from migrations via `pnpm supabase:gen-types`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

export type AppSupabaseClient = SupabaseClient<Database>;

export function createBrowserSupabase(url: string, anonKey: string): AppSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
}

export function createServerSupabase(
  url: string,
  serviceRoleKey: string,
): AppSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
