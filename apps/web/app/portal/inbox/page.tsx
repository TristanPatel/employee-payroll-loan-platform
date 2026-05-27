import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

const TEMPLATE_LABELS: Record<string, string> = {
  application_approved: 'Your application was approved',
  application_rejected: 'Your application was declined',
  approval_progress: 'Your application moved forward',
};

export default async function PortalInboxPage(): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) return <p>Sign in to view your inbox.</p>;
  const supabase = await createSupabaseServer();
  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, template, payload, created_at')
    .eq('recipient_id', profile.id)
    .eq('channel', 'in_app')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink-base">Inbox</h1>
      <Card>
        <CardContent className="p-0">
          {notifs && notifs.length > 0 ? (
            <ul>
              {notifs.map((n) => {
                const payload = (n.payload ?? {}) as Record<string, unknown>;
                const appNo = payload.application_no as string | undefined;
                const label = TEMPLATE_LABELS[n.template] ?? n.template.replace(/_/g, ' ');
                return (
                  <li key={n.id} className="border-b border-ink-muted/5 px-6 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-ink-base">{label}</div>
                        {appNo ? (
                          <Link
                            href="/portal/my-application"
                            className="text-xs text-richmond-primary hover:underline"
                          >
                            {appNo}
                          </Link>
                        ) : null}
                        {payload.decision ? (
                          <div className="mt-1 text-xs text-ink-muted">
                            Decision: <strong>{String(payload.decision)}</strong>
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
