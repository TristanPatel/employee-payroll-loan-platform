import Link from 'next/link';
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { RichmondLogo } from '@/components/brand/richmond-logo';

export const dynamic = 'force-dynamic';

/**
 * Employer picker — the single entry point after the landing's "Apply now"
 * CTA. Mobile-first card list of partner employers; tapping one jumps into
 * /apply/[slug] which has employer-specific rates and the full sign-up flow.
 */
export default async function EmployerPickerPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: employers } = await supabase
    .from('employers')
    .select('id, legal_name, trading_name, slug, max_tenure_months, monthly_interest_rate')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('legal_name', { ascending: true });

  const tel = '+260965503484';
  const wa = `https://wa.me/${tel.replace(/[^\d]/g, '')}`;

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-20 border-b border-ink-muted/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Richmond Finance">
            <RichmondLogo height={32} />
          </Link>
          <Link
            href="/sign-in"
            className="text-xs font-medium text-ink-muted hover:text-richmond-primary"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-ink-base sm:text-3xl">Pick your employer</h1>
        <p className="mt-2 text-sm text-ink-muted">
          You can only apply through a Richmond partner employer. Tap yours below to see your
          scheme&apos;s rates and start the application.
        </p>

        <div className="mt-6 space-y-3">
          {(employers ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/apply/${e.slug}`}
              className="group flex items-center justify-between rounded-xl border border-ink-muted/10 bg-white p-4 shadow-sm transition hover:border-richmond-primary"
            >
              <div className="min-w-0">
                <div className="truncate text-base font-medium text-ink-base group-hover:text-richmond-primary">
                  {e.trading_name ?? e.legal_name}
                </div>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {(Number(e.monthly_interest_rate) * 100).toFixed(2)}% per month · up to{' '}
                  {e.max_tenure_months} months
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-richmond-primary" />
            </Link>
          ))}

          {(employers ?? []).length === 0 ? (
            <p className="rounded-xl border border-ink-muted/10 bg-white p-6 text-center text-sm text-ink-muted">
              No partner employers yet.
            </p>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border border-richmond-primary/20 bg-richmond-primary/5 p-5 text-center">
          <p className="text-sm font-medium text-ink-base">Don&apos;t see your employer?</p>
          <p className="mt-1 text-xs text-ink-muted">
            We&apos;ll onboard them. Drop us a WhatsApp with your company name.
          </p>
          <a
            href={wa}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-richmond-primary shadow-sm transition hover:bg-richmond-primary hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            Message Richmond
          </a>
        </div>
      </div>
    </main>
  );
}
