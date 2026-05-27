import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

const TEMPLATE_LABELS: Record<string, string> = {
  cse_review_started: 'CSE review queue',
  l1_pending: 'L1 approval pending',
  l2_pending: 'L2 approval pending',
  l3_pending: 'L3 approval pending',
  application_approved: 'Application approved',
  application_rejected: 'Application rejected',
  approval_progress: 'Approval progressed',
};

export default async function StaffInboxPage(): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) return <p>Sign in to view your inbox.</p>;
  const supabase = await createSupabaseServer();
  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, template, payload, sent_at, status, created_at, channel')
    .eq('recipient_id', profile.id)
    .eq('channel', 'in_app')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Inbox</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Application + contract events routed to you. The latest 50 are shown.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {notifs && notifs.length > 0 ? (
            <ul>
              {notifs.map((n) => {
                const payload = (n.payload ?? {}) as Record<string, unknown>;
                const appId = payload.application_id as string | undefined;
                const appNo = (payload.application_no as string | undefined) ?? appId?.slice(0, 8);
                const label = TEMPLATE_LABELS[n.template] ?? n.template;
                return (
                  <li
                    key={n.id}
                    className="border-b border-ink-muted/5 px-6 py-3 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-ink-base">{label}</div>
                        {appNo ? (
                          <Link
                            href={`/admin/applications/${appId}`}
                            className="text-xs text-richmond-primary hover:underline"
                          >
                            {appNo}
                          </Link>
                        ) : null}
                        {payload.decision ? (
                          <div className="mt-1 text-xs text-ink-muted">
                            Tier {String(payload.tier).toUpperCase()} ·{' '}
                            decision <strong>{String(payload.decision)}</strong> ·
                            next status <strong>{String(payload.next_status)}</strong>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right text-[11px] text-ink-muted">
                        {formatLusakaDateTime(n.created_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No notifications yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
