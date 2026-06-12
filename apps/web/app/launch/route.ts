import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Role-based post-sign-in router. /sign-in and signup flows land here, and
 * each role gets sent to its own home:
 *   employee            → /portal
 *   employer_admin/sig  → /employer
 *   richmond staff      → /admin
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const profile = await getSessionProfile();
  const base = req.nextUrl.origin;
  if (!profile) return NextResponse.redirect(`${base}/sign-in`);
  if (profile.role === 'employee') return NextResponse.redirect(`${base}/portal`);
  if (profile.role === 'employer_admin' || profile.role === 'employer_signatory') {
    return NextResponse.redirect(`${base}/employer`);
  }
  return NextResponse.redirect(`${base}/admin`);
}
