import Link from 'next/link';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { RecoveryForm } from './recovery-form';

export const dynamic = 'force-dynamic';

export default function RecoverPage(): React.ReactElement {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-base px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <RichmondLogo height={56} />
          </div>
          <h1 className="text-2xl font-semibold text-ink-base">Set a new password</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Choose a strong password. You&apos;ll be signed in immediately.
          </p>
        </div>
        <RecoveryForm />
        <p className="mt-6 text-center text-xs">
          <Link href="/sign-in" className="text-richmond-primary hover:underline">
            ← Back to sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
