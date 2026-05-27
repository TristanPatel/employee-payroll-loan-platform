import Link from 'next/link';
import { Building2, Users, Briefcase, ArrowRight } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const [{ count: employerCount }, { count: branchCount }, { count: profileCount }] = await Promise.all([
    supabase.from('employers').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('branches').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Master admin</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Configure the lending estate. Start with employers — every loan needs one.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/admin/employers"
          icon={Building2}
          label="Employers"
          value={employerCount ?? 0}
          description="Active employer partners"
        />
        <StatCard
          href="/admin/branches"
          icon={Briefcase}
          label="Branches"
          value={branchCount ?? 0}
          description="Richmond branch network"
        />
        <StatCard
          href="/admin/staff"
          icon={Users}
          label="Profiles"
          value={profileCount ?? 0}
          description="All users (staff + employer HR + employees)"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase status</CardTitle>
          <CardDescription>What works today, what arrives next.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-ink-base">
            <li>
              <span className="font-medium">Phase 3 (this UI)</span> — master_admin can create &amp;
              edit employers, add signatories, configure lending economics
            </li>
            <li className="text-ink-muted">
              <span className="font-medium">Phase 4 (next)</span> — employee application + digital
              contract foundation
            </li>
            <li className="text-ink-muted">
              <span className="font-medium">Phase 5</span> — CSE due diligence + L1/L2/L3 approvals
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  description,
}: {
  href: string;
  icon: typeof Building2;
  label: string;
  value: number;
  description: string;
}): React.ReactElement {
  return (
    <Link href={href} className="block">
      <Card className="transition hover:border-richmond-primary/40">
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink-base">{value}</div>
            <div className="mt-1 text-xs text-ink-muted">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-muted" />
        </CardContent>
      </Card>
    </Link>
  );
}
