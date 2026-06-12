import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Streams the borrower's loan statement PDF. Proxies the
 * render-loan-statement Edge Function using the caller's own session token,
 * so RLS guarantees a borrower can only ever pull their own loan.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  const loanId = req.nextUrl.searchParams.get('loan');
  if (!loanId) return NextResponse.json({ error: 'loan param required' }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes.session?.access_token;
  if (!token) return NextResponse.json({ error: 'no active session' }, { status: 401 });

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/render-loan-statement`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ loan_id: loanId }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || `statement render failed (${res.status})` }, {
      status: res.status,
    });
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('Content-Disposition') ?? 'inline; filename="loan-statement.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
