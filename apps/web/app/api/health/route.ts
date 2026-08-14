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
  // `checks` are CRITICAL: any failure here 503s, and this endpoint is Fly's
  // http_service health check on the single machine — so only a genuinely
  // dead dependency (the DB) belongs here. `signals` are INFORMATIONAL: things
  // external monitors/alerting should watch but that must never take the
  // machine out of rotation. The notification queue lives in `signals` for
  // exactly this reason — a stalled worker backing the queue up must page an
  // operator, not knock the whole portal offline.
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const signals: Record<string, { ok: boolean; detail?: string }> = {};
  const started = Date.now();
  const supabase = await createSupabaseServer();

  // CRITICAL 1. Database round-trip — read a tiny known table
  try {
    const { error } = await supabase
      .from('branches')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    checks.database = { ok: !error, detail: error?.message };
  } catch (e) {
    checks.database = { ok: false, detail: (e as Error).message };
  }

  // SIGNAL. Notification queue depth AND oldest-queued age. Depth alone hides a
  // silently-stalled worker (a fixed backlog under the threshold reads fine);
  // age exposes it. Both are non-fatal — reported, never 503.
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'queued');
    if (error) throw error;
    const { data: oldest } = await supabase
      .from('notifications')
      .select('created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const oldestAgeMin = oldest?.created_at
      ? Math.round((Date.now() - new Date(oldest.created_at as string).getTime()) / 60000)
      : 0;
    const depth = count ?? 0;
    // Healthy drain runs every 5 min; a queued item older than ~30 min means
    // the worker isn't draining (stalled, 401ing, or misconfigured).
    signals.notification_queue = {
      ok: depth < 500 && oldestAgeMin < 30,
      detail: `${depth} queued; oldest ${oldestAgeMin} min`,
    };
  } catch (e) {
    signals.notification_queue = { ok: false, detail: (e as Error).message };
  }

  // SIGNAL. Latest migration applied — proves the DB is at the expected version.
  try {
    const { data, error } = await supabase
      .from('schema_migrations' as never)
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    signals.migrations = {
      ok: Boolean(data),
      detail: (data as { version?: string } | null)?.version ?? 'none',
    };
  } catch {
    // schema_migrations isn't readable for everyone — soft-pass
    signals.migrations = { ok: true, detail: 'unverifiable from anon role' };
  }

  const criticalOk = Object.values(checks).every((c) => c.ok);
  const signalsOk = Object.values(signals).every((c) => c.ok);
  return NextResponse.json(
    {
      // 'ok' = fully healthy; 'degraded' = a non-fatal signal is unhappy but the
      // machine stays in rotation; only a failed critical check yields 503.
      status: criticalOk ? (signalsOk ? 'ok' : 'degraded') : 'unhealthy',
      checks,
      signals,
      elapsed_ms: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: criticalOk ? 200 : 503 },
  );
}
