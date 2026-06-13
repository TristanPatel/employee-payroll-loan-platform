import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from './lib/supabase/middleware';

const PROTECTED = ['/admin', '/portal', '/branch', '/employer'];

export async function middleware(request: NextRequest) {
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
  }

  return response;
}

export const config = {
  // Run for every path except Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
