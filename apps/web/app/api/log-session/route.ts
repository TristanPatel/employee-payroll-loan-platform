import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records a sign-in / page-access event in audit_log via log_event().
 * Called from middleware once per user per ~10 minutes so we get a
 * coarse-grained activity trail without flooding the log.
 *
 * Identity is taken from the caller's session cookie; the body just
 * carries optional details (path, user-agent). The RPC writes nothing
 * if auth.uid() is null.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { kind = 'session.access', path } = (await req
    .json()
    .catch(() => ({}))) as { kind?: string; path?: string };

  const supabase = await createSupabaseServer();
  const ua = req.headers.get('user-agent')?.slice(0, 220) ?? null;
  const ip =
    req.headers.get('fly-client-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  await supabase.rpc('log_event', {
    p_kind: kind,
    p_entity_type: 'session',
    p_details: { path: path ?? null, ip, user_agent: ua },
  });
  return NextResponse.json({ ok: true });
}
