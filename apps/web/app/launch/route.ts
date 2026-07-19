import { getSessionProfile } from '@/lib/auth';
import { safeNext } from '@/lib/safe-next';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Role-based post-sign-in router. /sign-in lands here, and each role gets
 * sent to its own home: employee → /portal, employer → /employer, Richmond
 * staff → /admin.
 *
 * A `next` query param (set by middleware when it bounces an unauthenticated
 * user off a protected path) is honoured only when it points inside the
 * signed-in role's own home area. A stale cross-role `next` — e.g. an
 * employer arriving with `next=/admin` because middleware parked them there —
 * is dropped, so the user lands on their home instead of bouncing off a
 * layout that rejects their role and looping back to /sign-in.
 *
 * We return a bare Location header (path-only) so the browser resolves
 * the destination against the request URL it actually visited. Going via
 * `req.nextUrl.origin` would surface Fly's internal bind host (0.0.0.0:3000)
 * because the proxy doesn't always forward Host downstream.
 */
export async function GET(req: Request): Promise<Response> {
  const profile = await getSessionProfile();
  if (!profile) {
    return new Response(null, { status: 307, headers: { Location: '/sign-in' } });
  }

  const home =
    profile.role === 'employee'
      ? '/portal'
      : profile.role === 'employer_admin' || profile.role === 'employer_signatory'
        ? '/employer'
        : '/admin';

  const next = new URL(req.url).searchParams.get('next');
  const target = safeNext(next, home);
  return new Response(null, { status: 307, headers: { Location: target } });
}
