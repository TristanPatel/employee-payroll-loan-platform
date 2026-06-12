import { getSessionProfile } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Role-based post-sign-in router. /sign-in lands here, and each role gets
 * sent to its own home: employee → /portal, employer → /employer, Richmond
 * staff → /admin.
 *
 * We return a bare Location header (path-only) so the browser resolves
 * the destination against the request URL it actually visited. Going via
 * `req.nextUrl.origin` would surface Fly's internal bind host (0.0.0.0:3000)
 * because the proxy doesn't always forward Host downstream.
 */
export async function GET(): Promise<Response> {
  const profile = await getSessionProfile();
  const target = !profile
    ? '/sign-in'
    : profile.role === 'employee'
      ? '/portal'
      : profile.role === 'employer_admin' || profile.role === 'employer_signatory'
        ? '/employer'
        : '/admin';
  return new Response(null, { status: 307, headers: { Location: target } });
}
