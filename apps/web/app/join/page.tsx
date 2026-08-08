import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { employerByCode } from '@/lib/employer-entry';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SchemeCard } from '../apply/_components/scheme-card';

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
        <p className="mt-6 text-center text-xs text-ink-muted">
          No code? Ask your HR office for your employer’s Richmond loan link or access code.
        </p>
      </div>
    </main>
  );
}

/**
 * Generic entry by access code. A borrower who already belongs to an employer
 * is sent straight into the wizard. With a valid code we preview the scheme
 * before they commit; an unknown code is reported without revealing whether any
 * other employer exists.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (profile?.role === 'employee' && profile.employer_id) {
    redirect('/portal/apply');
  }

  const code = searchParams.code?.trim().toUpperCase();
  if (code) {
    const supabase = await createSupabaseServer();
    const employer = await employerByCode(supabase, code);
    if (employer) {
      return (
        <Shell>
          <SchemeCard employer={employer} code={code} signedIn={profile?.role === 'employee'} />
        </Shell>
      );
    }
  }

  return (
    <Shell>
      <Card>
        <form method="get" action="/join">
          <CardHeader>
            <CardTitle>Join your employer’s scheme</CardTitle>
            <CardDescription>Enter the access code from your HR notice or poster.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="code" required>
                Access code
              </Label>
              <Input
                id="code"
                name="code"
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                defaultValue={code ?? ''}
                placeholder="e.g. 7K2P9QR4"
                className="mt-1 text-center text-lg uppercase tracking-[0.3em]"
              />
              <FieldHelp>8 characters. It looks like a short mix of letters and numbers.</FieldHelp>
            </div>
            {code ? (
              <FieldError message="That access code didn’t match. Check it against your employer’s notice and try again." />
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">Continue</Button>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs">
        <Link href="/sign-in" className="text-richmond-primary hover:underline">
          Already applied before? Sign in
        </Link>
      </p>
    </Shell>
  );
}
