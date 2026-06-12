import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRichmondStaff } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

interface TimelineEvent {
  at: string;
  kind: string;
  title: string;
  detail: string;
  actor: string | null;
}

/**
 * Full chronological reconstruction of everything that happened to an
 * application: audit-log status transitions, due-diligence sign-offs,
 * approvals, contract signatures + consent events, and outbound
 * notifications. This is the page to open when an inspector asks
 * "show me the history of this loan".
 */
export default async function ApplicationTimelinePage({
  params,
}: {
  params: { id: string };
}): Promise<React.ReactElement> {
  await requireRichmondStaff();
  const supabase = await createSupabaseServer();

  const { data: app } = await supabase
    .from('loan_applications')
    .select('id, application_no, contracts ( id )')
    .eq('id', params.id)
    .maybeSingle();
  if (!app) notFound();

  const contractIds = ((app.contracts as Array<{ id: string }> | null) ?? []).map((c) => c.id);
  const { data: loan } = await supabase
    .from('loans')
    .select('id, loan_no')
    .eq('application_id', app.id)
    .maybeSingle();

  const entityIds = [app.id, ...contractIds, ...(loan ? [loan.id] : [])];

  const [{ data: audits }, { data: approvals }, { data: signoffs }, { data: signatures }, { data: contractEvents }, { data: notifs }] =
    await Promise.all([
      supabase
        .from('audit_log')
        .select('action, entity_type, before, after, occurred_at, actor_id, profiles:actor_id ( full_name )')
        .in('entity_id', entityIds)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('approvals')
        .select('tier, decision, notes, decided_at, profiles ( full_name )')
        .eq('application_id', app.id),
      supabase
        .from('due_diligence_signoffs')
        .select('role_key, signed_at, profiles ( full_name )')
        .eq('application_id', app.id),
      contractIds.length
        ? supabase
            .from('contract_signatures')
            .select('signatory_role, signatory_name_snapshot, signed_at')
            .in('contract_id', contractIds)
        : Promise.resolve({ data: [] as never[] }),
      contractIds.length
        ? supabase
            .from('contract_audit_events')
            .select('event_type, occurred_at, profiles:actor_profile_id ( full_name )')
            .in('contract_id', contractIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from('notifications')
        .select('channel, template, status, created_at')
        .filter('payload->>application_id', 'eq', app.id),
    ]);

  const events: TimelineEvent[] = [];

  for (const a of audits ?? []) {
    const before = (a.before ?? {}) as Record<string, unknown>;
    const after = (a.after ?? {}) as Record<string, unknown>;
    const statusChanged = before.status !== after.status && after.status;
    events.push({
      at: a.occurred_at,
      kind: 'audit',
      title:
        a.action === 'INSERT'
          ? `${a.entity_type} created`
          : statusChanged
            ? `${a.entity_type}: ${String(before.status ?? '—')} → ${String(after.status)}`
            : `${a.entity_type} updated`,
      detail: a.action,
      actor: (a.profiles as { full_name?: string } | null)?.full_name ?? null,
    });
  }
  for (const ap of approvals ?? []) {
    events.push({
      at: ap.decided_at,
      kind: 'approval',
      title: `${String(ap.tier).toUpperCase()} ${ap.decision}`,
      detail: ap.notes ?? '',
      actor: (ap.profiles as { full_name?: string } | null)?.full_name ?? null,
    });
  }
  for (const so of signoffs ?? []) {
    events.push({
      at: so.signed_at,
      kind: 'signoff',
      title: `Due-diligence sign-off (${so.role_key})`,
      detail: '',
      actor: (so.profiles as { full_name?: string } | null)?.full_name ?? null,
    });
  }
  for (const sig of signatures ?? []) {
    events.push({
      at: sig.signed_at,
      kind: 'signature',
      title: `Contract signed as ${sig.signatory_role}`,
      detail: '',
      actor: sig.signatory_name_snapshot,
    });
  }
  for (const ev of contractEvents ?? []) {
    events.push({
      at: ev.occurred_at,
      kind: 'contract',
      title: `Contract event: ${ev.event_type}`,
      detail: '',
      actor: (ev.profiles as { full_name?: string } | null)?.full_name ?? null,
    });
  }
  for (const n of notifs ?? []) {
    events.push({
      at: n.created_at,
      kind: 'notification',
      title: `Notification ${n.template} via ${n.channel}`,
      detail: n.status,
      actor: null,
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const DOT: Record<string, string> = {
    audit: 'bg-ink-muted',
    approval: 'bg-richmond-primary',
    signoff: 'bg-status-info',
    signature: 'bg-status-success',
    contract: 'bg-status-warning',
    notification: 'bg-ink-muted/50',
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/admin/applications/${app.id}`}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to application
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">
          Timeline — {app.application_no ?? app.id.slice(0, 8)}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {events.length} events reconstructed from the audit log, approvals, sign-offs,
          signatures and notifications. {loan ? `Loan ${loan.loan_no}.` : ''}
        </p>
      </div>
      <Card>
        <CardContent>
          <ol className="relative ml-3 space-y-5 border-l border-ink-muted/15 py-2">
            {events.map((e, i) => (
              <li key={i} className="relative pl-6">
                <span
                  className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${DOT[e.kind] ?? 'bg-ink-muted'}`}
                />
                <div className="text-sm font-medium text-ink-base">{e.title}</div>
                <div className="text-xs text-ink-muted">
                  {formatLusakaDateTime(e.at)}
                  {e.actor ? ` · ${e.actor}` : ''}
                  {e.detail ? ` · ${e.detail}` : ''}
                </div>
              </li>
            ))}
            {events.length === 0 ? (
              <li className="pl-6 text-sm text-ink-muted">No recorded events.</li>
            ) : null}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
