import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same-origin proxy to phone-otp-verify. Mirrors phone-otp-start; the
// function returns either { error } or { ok: true, action_link } on
// success — the client navigates to the action_link to redeem the
// Supabase session cookie.

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'phone OTP not configured' }, { status: 503 });
  }
  const body = await req.text();
  const fwd = await fetch(`${SUPABASE_URL}/functions/v1/phone-otp-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON}`,
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
