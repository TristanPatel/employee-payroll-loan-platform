import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function BranchesPage(): Promise<React.ReactElement> {
  await requireMasterAdmin();
  const supabase = await createSupabaseServer();
  const { data: branches } = await supabase
    .from('branches')
    .select('id, branch_code, name, status, created_at')
    .is('deleted_at', null)
    .order('branch_code', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Branches</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Physical branch network. Branch codes are baked into per-branch loan
          number sequences and are immutable once issued.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {branches && branches.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-muted/10 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-ink-muted/5 last:border-0">
                    <td className="px-6 py-3 font-mono text-xs text-ink-base">{b.branch_code}</td>
                    <td className="px-6 py-3 text-ink-base">{b.name}</td>
                    <td className="px-6 py-3 text-ink-muted">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">No branches.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
