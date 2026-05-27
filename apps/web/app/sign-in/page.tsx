import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect(searchParams.next ?? '/admin');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface-base px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-richmond-primary text-base font-bold text-white">
            RF
          </div>
          <h1 className="text-2xl font-semibold text-ink-base">Employee Payroll Loan Portal</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to continue</p>
        </div>

        <SignInForm next={searchParams.next} initialError={searchParams.error} />

        <p className="mt-6 text-center text-xs text-ink-muted">
          Phone-OTP and biometric flows arrive in Phase 4 (employee mobile app).
        </p>
        <p className="mt-1 text-center text-xs">
          <Link href="/" className="text-richmond-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
