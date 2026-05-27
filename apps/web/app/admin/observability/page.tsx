import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface QueueRow {
  channel: string;
  status: string;
  count: number;
}

interface RecentNotif {
  id: string;
  template: string;
  channel: string;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export default async function ObservabilityPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();

  // Aggregate the queue by (channel, status).
  const { data: notifs } = await supabase
    .from('notifications')
    .select('channel, status')
    .is('deleted_at', null);
  const grid = new Map<string, number>();
  for (const n of notifs ?? []) {
    const k = `${n.channel}|${n.status}`;
    grid.set(k, (grid.get(k) ?? 0) + 1);
  }
  const queue: QueueRow[] = Array.from(grid.entries())
    .map(([k, count]) => {
      const [channel, status] = k.split('|');
      return { channel: channel!, status: status!, count };
    })
    .sort((a, b) =>
      a.channel.localeCompare(b.channel) || a.status.localeCompare(b.status),
    );

  // Last 20 failed or recently-sent rows
  const { data: recent } = await supabase
    .from('notifications')
    .select('id, template, channel, status, error, created_at, sent_at')
    .in('status', ['failed', 'sent'] as never)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Loan + application pipeline counts
  const [appCounts, loanCounts] = await Promise.all([
    aggregate(supabase, 'loan_applications', 'status'),
    aggregate(supabase, 'loans', 'status'),
  ]);

  const totalQueued = (queue.find((q) => q.status === 'queued')?.count ?? 0);
  const totalFailed = (queue.find((q) => q.status === 'failed')?.count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Observability</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Real-time queue depth + pipeline status. Hit{' '}
          <code className="text-xs">/api/health</code> for a JSON probe suitable for external
          monitors.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Queued notifications" value={totalQueued.toString()}
              tone={totalQueued > 500 ? 'danger' : totalQueued > 100 ? 'warning' : 'success'} />
        <Tile label="Failed notifications" value={totalFailed.toString()}
              tone={totalFailed > 0 ? 'danger' : 'success'} />
        <Tile label="Applications in queue"
              value={String(['cse_review','l1_pending','l2_pending','l3_pending']
                .reduce((sum, s) => sum + (appCounts[s] ?? 0), 0))}
              tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification queue depth</CardTitle>
          <CardDescription>Per (channel × status). Tail this on Mondays to catch Twilio outages.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table headers={['Channel', 'Status', 'Count']}
                 rows={queue.map((q) => [q.channel, q.status, q.count.toString()])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last 20 notification rows</CardTitle>
          <CardDescription>Look for repeated failures to spot provider outages or bad phone numbers.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table headers={['Created', 'Channel', 'Template', 'Status', 'Sent at', 'Error']}
                 rows={(recent ?? []).map((r: RecentNotif) => [
                   formatLusakaDateTime(r.created_at),
                   r.channel,
                   r.template,
                   r.status,
                   r.sent_at ? formatLusakaDateTime(r.sent_at) : '—',
                   r.error ?? '—',
                 ])} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table headers={['Status', 'Count']}
                   rows={Object.entries(appCounts).map(([k, v]) => [k, String(v)])} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Loans by status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table headers={['Status', 'Count']}
                   rows={Object.entries(loanCounts).map(([k, v]) => [k, String(v)])} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function aggregate(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  table: 'loan_applications' | 'loans',
  field: 'status',
): Promise<Record<string, number>> {
  const { data } = await supabase.from(table).select(field).is('deleted_at', null);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { status: string }[]) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}

function Tile({
  label, value, tone,
}: { label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'info' }): React.ReactElement {
  const toneClass = {
    success: 'text-status-success',
    warning: 'text-status-warning',
    danger:  'text-status-danger',
    info:    'text-status-info',
  }[tone];
  return (
    <div className="rounded-md border border-ink-muted/10 bg-white px-6 py-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }): React.ReactElement {
  if (rows.length === 0) {
    return <div className="px-6 py-8 text-center text-sm text-ink-muted">No rows.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
          {headers.map((h) => <th key={h} className="px-6 py-3 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-ink-muted/5 last:border-0">
            {row.map((cell, j) => (
              <td key={j} className="px-6 py-2 text-ink-base">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
