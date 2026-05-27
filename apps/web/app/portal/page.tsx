import Link from 'next/link';
import { ArrowRight, FileText, ScrollText } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function PortalHomePage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: latestApp } = await supabase
    .from('loan_applications')
    .select('id, status, requested_amount_ngwee, requested_tenure_months, application_no, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink-base">Welcome</h1>

      {latestApp ? (
        <Card>
          <CardHeader>
            <CardTitle>Your latest application</CardTitle>
            <CardDescription>Status: {latestApp.status}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-base">
              Application <strong>{latestApp.application_no ?? latestApp.id.slice(0, 8)}</strong>
              {' '}for K {(Number(latestApp.requested_amount_ngwee) / 100).toLocaleString('en-ZM')}
              {' '}over {latestApp.requested_tenure_months} months.
            </p>
            <Link
              href="/portal/my-application"
              className="mt-3 inline-flex items-center gap-1 text-sm text-richmond-primary hover:underline"
            >
              View details <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/portal/apply">
          <Card className="transition hover:border-richmond-primary/40">
            <CardContent className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-richmond-primary" />
              <div>
                <div className="font-medium text-ink-base">Apply for a loan</div>
                <div className="text-xs text-ink-muted">Multi-step application — 10 min</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/portal/my-application">
          <Card className="transition hover:border-richmond-primary/40">
            <CardContent className="flex items-center gap-3">
              <ScrollText className="h-6 w-6 text-richmond-primary" />
              <div>
                <div className="font-medium text-ink-base">My application</div>
                <div className="text-xs text-ink-muted">Status, history, documents</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
