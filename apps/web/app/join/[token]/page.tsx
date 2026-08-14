import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { employerByInvite } from '@/lib/employer-entry';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SchemeCard } from '../../apply/_components/scheme-card';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-base px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <RichmondLogo height={48} />
          </div>
          <p className="text-xs uppercase tracking-widest text-ink-muted">Employee Payroll Loan Portal</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * HR invite-link entry. The token resolves to exactly one employer; if it's
 * valid we preview the scheme and let the borrower start (binding on submit).
 * An unknown / expired / revoked token is reported without leaking anything.
 */
export default async function JoinTokenPage({
  params,
}: {
  params: { token: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (profile?.role === 'employee' && profile.employer_id) {
    redirect('/portal/apply');
  }

  const supabase = await createSupabaseServer();
  const employer = await employerByInvite(supabase, params.token);

  if (!employer) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>This link isn’t valid</CardTitle>
            <CardDescription>
              The invitation may have expired or been withdrawn. Ask your HR office for a fresh
              link, or enter your employer’s access code instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/join" className="text-sm text-richmond-primary hover:underline">
              Enter an access code →
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <SchemeCard employer={employer} token={params.token} signedIn={profile?.role === 'employee'} />
    </Shell>
  );
}
