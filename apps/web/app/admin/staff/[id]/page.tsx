import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

/**
 * Per-user audit drill-down: a single profile's details plus everything they
 * did (actor_id) and everything done to their record (entity_id). The full,
 * filterable feed lives at /admin/activity; this is the focused per-person view.
 */
export default async function StaffMemberPage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  await requireRole(['master_admin', 'auditor']);
  const supabase = await createSupabaseServer();

  const { data: person } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, branch_id, employer_id, is_active, deleted_at, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!person) notFound();

  const [{ data: byActor }, { data: aboutThem }] = await Promise.all([
    supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, occurred_at, ip')
      .eq('actor_id', params.id)
      .order('occurred_at', { ascending: false })
      .limit(100),
    supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, occurred_at, actor_id')
      .eq('entity_id', params.id)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ]);

  const lastSignIn = (byActor ?? []).find((e) => e.action.startsWith('session.'))?.occurred_at;
  const actionCount = (byActor ?? []).length;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to staff
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">{person.full_name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {person.role} · {person.email ?? person.phone ?? '—'}
            {person.deleted_at ? ' · deleted' : person.is_active ? '' : ' · inactive'}
          </p>
        </div>
        <Link
          href={`/admin/activity?actor=${person.id}`}
          className="text-sm font-medium text-richmond-primary hover:underline"
        >
          Open in activity log →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Logged actions" value={String(actionCount)} />
        <Stat label="Last seen" value={lastSignIn ? formatLusakaDateTime(lastSignIn) : '—'} />
        <Stat label="Member since" value={formatLusakaDateTime(person.created_at)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What they did</CardTitle>
          <CardDescription>Most recent 100 actions taken by this account.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {byActor && byActor.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">When</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Entity</th>
                  <th className="px-6 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {byActor.map((e) => (
                  <tr key={e.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3 text-xs text-ink-muted">{formatLusakaDateTime(e.occurred_at)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-base">{e.action}</td>
                    <td className="px-6 py-3 text-xs text-ink-muted">{e.entity_type}</td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-muted">{String(e.ip ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-ink-muted">No recorded actions.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changes to this account</CardTitle>
          <CardDescription>Edits made to this user&apos;s profile by anyone.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {aboutThem && aboutThem.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {aboutThem.map((e) => (
                  <tr key={e.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3 text-xs text-ink-muted">{formatLusakaDateTime(e.occurred_at)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-base">{e.action}</td>
                    <td className="px-6 py-3 text-xs text-ink-muted">{e.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-ink-muted">No recorded changes.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Card>
      <CardContent>
        <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
        <div className="mt-2 text-lg font-semibold text-ink-base">{value}</div>
      </CardContent>
    </Card>
  );
}
