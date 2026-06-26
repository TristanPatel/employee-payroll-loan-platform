import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same-origin proxy to phone-otp-confirm-application. Unlike the signup
// proxies, this one forwards the borrower's real access token (pulled from
// the cookie-backed session) so the edge function can identify them and
// stamp the right loan_applications row.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(req: Request): Promise<Response> {
  if (!SUPABASE_URL) {
    return NextResponse.json({ error: 'phone OTP not configured' }, { status: 503 });
  }
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }
  const body = await req.text();
  const fwd = await fetch(`${SUPABASE_URL}/functions/v1/phone-otp-confirm-application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      'user-agent': req.headers.get('user-agent') ?? '',
    },
    body,
  });
  return new NextResponse(await fwd.text(), {
    status: fwd.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
