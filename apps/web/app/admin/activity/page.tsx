import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

/**
 * Master_admin + auditor activity feed: every audited row change, every
 * admin action, every session ping. Filters by actor, action and entity
 * type via URL params so a deep-link can be shared with regulators.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { actor?: string; action?: string; entity?: string; page?: string };
}): Promise<React.ReactElement> {
  await requireRole(['master_admin', 'auditor']);
  const supabase = await createSupabaseServer();

  const page = Math.max(0, Number(searchParams.page ?? 0));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, actor_id, occurred_at, ip, after')
    .order('occurred_at', { ascending: false })
    .range(from, to);
  if (searchParams.action) q = q.eq('action', searchParams.action);
  if (searchParams.entity) q = q.eq('entity_type', searchParams.entity);
  if (searchParams.actor) q = q.eq('actor_id', searchParams.actor);

  const { data: rows } = await q;

  // Look up actor names in one round trip
  const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name, email, role').in('id', actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((p) => [p.id, p]));

  // Distinct entity types + recent actions for the filter dropdowns
  const { data: actionList } = await supabase
    .from('audit_log')
    .select('action')
    .order('occurred_at', { ascending: false })
    .limit(500);
  const distinctActions = Array.from(new Set((actionList ?? []).map((r) => r.action))).sort();
  const distinctEntities = Array.from(
    new Set((rows ?? []).map((r) => r.entity_type)),
  ).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Activity log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every row change, admin action and session in one place. Filters work via the URL —
          link a filtered view to share with auditors.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Server-side; results below update on Apply. Clear any filter by setting it to —.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-4" action="/admin/activity">
            <label className="text-xs text-ink-muted">
              Action
              <select
                name="action"
                defaultValue={searchParams.action ?? ''}
                className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm"
              >
                <option value="">— any —</option>
                {distinctActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Entity
              <select
                name="entity"
                defaultValue={searchParams.entity ?? ''}
                className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 text-sm"
              >
                <option value="">— any —</option>
                {distinctEntities.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Actor (profile id)
              <input
                name="actor"
                defaultValue={searchParams.actor ?? ''}
                placeholder="uuid"
                className="mt-1 block h-9 w-full rounded-md border border-ink-muted/20 bg-white px-2 font-mono text-xs"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 w-full rounded-md bg-richmond-primary px-4 text-sm font-medium text-white hover:bg-richmond-primary-dark"
              >
                Apply
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows && rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">When</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Entity</th>
                  <th className="px-6 py-3 font-medium">Actor</th>
                  <th className="px-6 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = r.actor_id ? actorMap.get(r.actor_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-ink-muted/5 align-top last:border-0">
                      <td className="px-6 py-3 text-xs text-ink-muted">
                        {formatLusakaDateTime(r.occurred_at)}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-ink-base">{r.action}</td>
                      <td className="px-6 py-3 text-xs">
                        <div className="font-medium text-ink-base">{r.entity_type}</div>
                        <div className="font-mono text-[10px] text-ink-muted">
                          {String(r.entity_id ?? '').slice(0, 12)}…
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs">
                        {a ? (
                          <>
                            <div className="font-medium text-ink-base">{a.full_name}</div>
                            <div className="text-ink-muted">{a.role}</div>
                          </>
                        ) : (
                          <span className="text-ink-muted">system</span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-ink-muted">{String(r.ip ?? '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No events match this filter.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <div>
          Page {page + 1} · showing up to {PAGE_SIZE} most recent events.
        </div>
        <div className="flex gap-3">
          {page > 0 ? (
            <Link
              href={pageHref(searchParams, page - 1)}
              className="text-richmond-primary hover:underline"
            >
              ← Newer
            </Link>
          ) : null}
          {rows && rows.length === PAGE_SIZE ? (
            <Link
              href={pageHref(searchParams, page + 1)}
              className="text-richmond-primary hover:underline"
            >
              Older →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function pageHref(
  sp: { actor?: string; action?: string; entity?: string },
  page: number,
): string {
  const u = new URLSearchParams();
  if (sp.actor) u.set('actor', sp.actor);
  if (sp.action) u.set('action', sp.action);
  if (sp.entity) u.set('entity', sp.entity);
  if (page > 0) u.set('page', String(page));
  return `/admin/activity?${u.toString()}`;
}
