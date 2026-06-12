import Link from 'next/link';
import {
  Activity, Bell, Briefcase, Building2, ClipboardList, Coins, FileSignature, FileText, Home,
  Landmark, ScrollText, Settings, Shield,
} from 'lucide-react';
import { requireRichmondStaff } from '@/lib/auth';
import type { Role } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { RealtimeRefresher } from '@/components/realtime-refresher';

export const dynamic = 'force-dynamic';

const ALL_STAFF: Role[] = [
  'master_admin', 'branch_manager', 'cse', 'approver_l1', 'approver_l2',
  'cfo', 'accounts', 'auditor',
];

const NAV: { href: string; label: string; icon: typeof Home; roles: Role[] }[] = [
  { href: '/admin', label: 'Dashboard', icon: Home, roles: ALL_STAFF },
  { href: '/admin/applications', label: 'Applications', icon: ClipboardList, roles: ALL_STAFF },
  { href: '/admin/contracts', label: 'Contracts', icon: FileSignature, roles: ALL_STAFF },
  { href: '/admin/loans', label: 'Loans', icon: Coins, roles: ALL_STAFF },
  { href: '/admin/remittance', label: 'Remittance', icon: Landmark, roles: ['master_admin', 'accounts', 'branch_manager', 'cfo'] },
  { href: '/admin/inbox', label: 'Inbox', icon: Bell, roles: ALL_STAFF },
  { href: '/admin/employers', label: 'Employers', icon: Building2, roles: ['master_admin', 'cfo'] },
  { href: '/admin/branches', label: 'Branches', icon: Briefcase, roles: ['master_admin'] },
  { href: '/admin/staff', label: 'Staff', icon: Shield, roles: ['master_admin'] },
  { href: '/admin/templates', label: 'Templates', icon: FileText, roles: ['master_admin'] },
  { href: '/admin/reports', label: 'Reports', icon: ScrollText, roles: ['master_admin', 'cfo', 'auditor'] },
  { href: '/admin/observability', label: 'Observability', icon: Activity, roles: ['master_admin', 'auditor'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['master_admin'] },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const profile = await requireRichmondStaff();
  const nav = NAV.filter((n) => n.roles.includes(profile.role));

  return (
    <div className="flex min-h-screen bg-surface-base">
      <aside className="w-60 shrink-0 border-r border-ink-muted/10 bg-white">
        <div className="border-b border-ink-muted/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <RichmondLogo height={36} />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">{profile.role.replace(/_/g, ' ')}</div>
            </div>
          </div>
        </div>

        <nav className="px-2 py-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-base hover:bg-surface-muted',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-ink-muted/10 bg-white px-6">
          <div className="text-sm text-ink-muted">
            Signed in as <span className="text-ink-base">{profile.full_name}</span>
          </div>
          <form action="/sign-out" method="POST">
            <button
              type="submit"
              className="text-xs font-medium text-ink-muted hover:text-richmond-primary"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <RealtimeRefresher
        tables={['loan_applications', 'contracts', 'loans', 'employer_attestations', 'due_diligence_checks']}
      />
    </div>
  );
}
