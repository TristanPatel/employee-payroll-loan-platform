import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffTable } from './staff-table';

export const dynamic = 'force-dynamic';

export default async function StaffPage(): Promise<React.ReactElement> {
  const me = await requireMasterAdmin();

  const supabase = await createSupabaseServer();
  const [{ data: profiles }, { data: branches }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, branch_id, is_active, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('branches')
      .select('id, name, branch_code')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('branch_code', { ascending: true }),
  ]);

  const rows = (profiles ?? []).map((p) => ({
    ...p,
    email: p.email as string | null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Staff &amp; access</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Assign roles, branches and active status. Only master admins can see this page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding a new staff member</CardTitle>
          <CardDescription>
            1. They create an account themselves: on the{' '}
            <span className="font-medium text-ink-base">sign-in page</span> they choose{' '}
            <span className="font-medium text-ink-base">&ldquo;Email me a code&rdquo;</span> and verify
            their work email. 2. Their account appears below as{' '}
            <span className="font-medium text-ink-base">Employee (borrower)</span> — change the role
            to what they actually do and press Save. The new permissions apply on their next page
            load.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length > 0 ? (
            <StaffTable rows={rows} branches={branches ?? []} selfId={me.id} />
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">No accounts yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
