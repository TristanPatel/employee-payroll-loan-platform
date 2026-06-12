import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function ProfilePage(): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) return <></>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink-base">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>
            Contact Richmond Finance to update your registered details. Sign-out is
            available from the top-right corner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Full name</dt>
            <dd className="text-right text-ink-base">{profile.full_name}</dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Email</dt>
            <dd className="text-right text-ink-base">{profile.email ?? '—'}</dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Phone</dt>
            <dd className="text-right text-ink-base">{profile.phone ?? '—'}</dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">NRC</dt>
            <dd className="text-right text-ink-base">{profile.nrc_no ?? '—'}</dd>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Role</dt>
            <dd className="text-right text-ink-base">{profile.role}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
