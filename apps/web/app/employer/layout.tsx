import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { RealtimeRefresher } from '@/components/realtime-refresher';

export const dynamic = 'force-dynamic';

export default async function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const profile = await requireRole(['employer_admin', 'employer_signatory']);

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="border-b border-ink-muted/10 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <RichmondLogo height={36} />
            <div className="text-xs text-ink-muted">Employer attestation portal</div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <span>{profile.full_name}</span>
            <Link href="/sign-out" className="hover:text-richmond-primary">
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      <RealtimeRefresher tables={['employer_attestations']} />
    </div>
  );
}
