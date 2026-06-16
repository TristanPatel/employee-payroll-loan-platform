import { getSessionProfile } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Role-based post-sign-in router. /sign-in lands here, and each role gets
 * sent to its own home: employee → /portal, employer → /employer, Richmond
 * staff → /admin.
 *
 * If a `next` query is supplied AND the role is allowed to visit it, we
 * honour it (deep-link after sign-in). Otherwise it's dropped: blindly
 * following `next` was the source of the employer "back to sign-in" loop —
 * a stale link to /admin would survive sign-in, get rejected by the admin
 * layout, and bounce the user back to /sign-in.
 *
 * Allowed prefixes by role:
 *   employee                          → /portal/*
 *   employer_admin, employer_signatory → /employer/*
 *   master_admin and other Richmond staff → /admin/*
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

  // Only a same-origin path is considered — drop anything that looks like
  // an external URL or a protocol-relative redirect.
  const next = new URL(req.url).searchParams.get('next');
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const target = safeNext && safeNext.startsWith(home) ? safeNext : home;

  return new Response(null, { status: 307, headers: { Location: target } });
}
