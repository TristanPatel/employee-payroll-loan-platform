import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupForm } from './signup-form';

export const dynamic = 'force-dynamic';

export default async function ApplySignupPage({
  params,
}: {
  params: { slug: string };
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: employer } = await supabase
    .from('employers')
    .select('id, legal_name, slug')
    .eq('slug', params.slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (!employer) notFound();

  // Already signed in? Skip to apply.
  const { data: userRes } = await supabase.auth.getUser();
  if (userRes.user) {
    redirect(`/portal/apply?employer=${employer.id}`);
  }

  return (
    <main className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-md space-y-6 px-6 py-12">
        <Link href={`/apply/${employer.slug}`} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary">
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Sign up to apply</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Applying to the {employer.legal_name} scheme. We&apos;ll email you a one-time code to verify your address.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              Phone-OTP signup arrives once Twilio is configured. Until then we use email OTP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm employerId={employer.id} employerSlug={employer.slug} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
