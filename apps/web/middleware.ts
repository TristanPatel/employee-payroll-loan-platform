import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from './lib/supabase/middleware';

const PROTECTED = ['/admin', '/portal', '/branch', '/employer'];

// The single legacy hostname we redirect away from once the canonical domain
// is live. Exact-match only — never "any host that isn't canonical" — so we
// can't accidentally loop the canonical host or a preview host onto itself.
const LEGACY_HOST = 'richmond-eplp-portal.fly.dev';

export async function middleware(request: NextRequest) {
  // Canonical-host redirect, armed only at cutover via CANONICAL_HOST (a Fly
  // runtime secret). Runs BEFORE updateSupabaseSession so no auth cookie is
  // ever set on a legacy-host response, and skips /api/* so Fly's health check
  // (GET /api/health, hitting the machine with no public Host) and API callers
  // are never redirected. 307 (not 308): a permanent redirect would be cached
  // indefinitely by browsers and wedge a rollback.
  const canonicalHost = process.env.CANONICAL_HOST;
  if (canonicalHost && !request.nextUrl.pathname.startsWith('/api/')) {
    const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host');
    if (host === LEGACY_HOST) {
      const target = `https://${canonicalHost}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(target, 307);
    }
  }

  const response = await updateSupabaseSession(request);

  // Cheap path-prefix check; full role gating runs in each layout's RSC.
  const { pathname } = request.nextUrl;
  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    // The cookie was refreshed inside updateSupabaseSession; we just need to
    // verify a session cookie now exists. If not, bounce to /sign-in.
    //
    // @supabase/ssr chunks the auth token when it exceeds a single cookie,
    // naming the parts `sb-<ref>-auth-token.0`, `.1`, … so an
    // endsWith('-auth-token') check misses every real (chunked) session and
    // bounces freshly-signed-in users straight back out — they land on the
    // home page instead of /admin or /portal. Match on a substring so both
    // the unchunked cookie and the chunked parts are recognised.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    if (!hasSession) {
      const signIn = new URL('/sign-in', request.url);
      signIn.searchParams.set('next', pathname);
      return NextResponse.redirect(signIn);
    }
    // Coarse-grained session telemetry: log at most once every 10 minutes
    // per user (tracked via a non-auth cookie so we don't touch the auth
    // cookie GoTrue manages). The route is fire-and-forget — failures must
    // not block the response.
    const SEEN = 'rf-session-seen';
    const seenAt = Number(request.cookies.get(SEEN)?.value ?? 0);
    if (Date.now() - seenAt > 10 * 60 * 1000) {
      // Tell the page to ping /api/log-session in the background.
      response.cookies.set(SEEN, String(Date.now()), {
        httpOnly: false,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24,
      });
      response.headers.set('x-rf-log-session', '1');
    }
  }

  return response;
}

export const config = {
  // Run for every path except Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
