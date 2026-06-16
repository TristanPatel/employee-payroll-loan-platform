import { createSupabaseServer } from '@/lib/supabase/server';
import { requireMasterAdmin } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffTable } from './staff-table';
import { AddAccount } from './add-account';

export const dynamic = 'force-dynamic';

export default async function StaffPage(): Promise<React.ReactElement> {
  const me = await requireMasterAdmin();

  const supabase = await createSupabaseServer();
  const [{ data: profiles }, { data: branches }, { data: employers }] = await Promise.all([
    // Staff & access manages Richmond staff and employer-side users only.
    // Borrowers (role='employee') self-onboard through the employer apply
    // link and are managed inside their applications/loans, so they don't
    // belong in this table.
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, branch_id, employer_id, is_active, created_at')
      .is('deleted_at', null)
      .neq('role', 'employee')
      .order('created_at', { ascending: false }),
    supabase
      .from('branches')
      .select('id, name, branch_code')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('branch_code', { ascending: true }),
    supabase
      .from('employers')
      .select('id, legal_name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('legal_name', { ascending: true }),
  ]);

  const rows = (profiles ?? []).map((p) => ({
    ...p,
    email: p.email as string | null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Staff &amp; access</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create accounts, assign roles and branches. Only master admins can see this page.
          </p>
        </div>
        <AddAccount branches={branches ?? []} employers={employers ?? []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>
            This page is for Richmond staff and employer-side users only. Use{' '}
            <span className="font-medium text-ink-base">Add account</span> to create one — they
            get a temporary password to sign in with, then can switch to email codes. (Self-signup
            on the sign-in page is disabled, so only people you create here can reach the back
            office.) Borrowers self-onboard through their employer&apos;s apply link and are
            managed under <span className="font-medium text-ink-base">Applications</span>.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rows.length > 0 ? (
            <StaffTable
              rows={rows}
              branches={branches ?? []}
              employers={employers ?? []}
              selfId={me.id}
            />
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">No staff accounts yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
