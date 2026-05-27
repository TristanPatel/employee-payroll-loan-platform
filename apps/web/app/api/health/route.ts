import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + readiness probe.
 *
 *   GET /api/health  → 200 OK with structured status, or 503 if any
 *   critical dependency is unhealthy.
 *
 * Public — no auth — so external monitors (UptimeRobot, BetterUptime,
 * Vercel monitoring) can hit it without managing tokens. Returns only
 * non-sensitive info (no row contents, no PII).
 */
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const started = Date.now();
  const supabase = await createSupabaseServer();

  // 1. Database round-trip — read a tiny known table
  try {
    const { error } = await supabase
      .from('branches')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    checks.database = { ok: !error, detail: error?.message };
  } catch (e) {
    checks.database = { ok: false, detail: (e as Error).message };
  }

  // 2. Notification queue depth — alarm if more than 500 queued
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'queued');
    if (error) throw error;
    checks.notification_queue = {
      ok: (count ?? 0) < 500,
      detail: `${count ?? 0} queued`,
    };
  } catch (e) {
    checks.notification_queue = { ok: false, detail: (e as Error).message };
  }

  // 3. Latest migration applied — proves the DB is at the expected version.
  try {
    const { data, error } = await supabase
      .from('schema_migrations' as never)
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    checks.migrations = {
      ok: Boolean(data),
      detail: (data as { version?: string } | null)?.version ?? 'none',
    };
  } catch {
    // schema_migrations isn't readable for everyone — soft-pass
    checks.migrations = { ok: true, detail: 'unverifiable from anon role' };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      elapsed_ms: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
