import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, Coins, FileText, Home, ScrollText, User } from 'lucide-react';
import { getSessionProfile } from '@/lib/auth';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/apply', label: 'Apply', icon: FileText },
  { href: '/portal/my-application', label: 'My application', icon: ScrollText },
  { href: '/portal/my-loan', label: 'My loan', icon: Coins },
  { href: '/portal/inbox', label: 'Inbox', icon: Bell },
  { href: '/portal/profile', label: 'Profile', icon: User },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/sign-in?next=/portal');
  }
  if (profile.role !== 'employee') {
    redirect('/sign-in?error=Employee%20portal%20is%20for%20employees%20only');
  }

  return (
    <div className="flex min-h-screen bg-surface-base">
      <aside className="w-56 shrink-0 border-r border-ink-muted/10 bg-white">
        <div className="border-b border-ink-muted/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-richmond-primary text-sm font-bold text-white">
              RF
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-base">Richmond Finance</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">My account</div>
            </div>
          </div>
        </div>
        <nav className="px-2 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-base hover:bg-surface-muted')}
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
            <button type="submit" className="text-xs font-medium text-ink-muted hover:text-richmond-primary">
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
