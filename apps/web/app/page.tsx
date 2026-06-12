import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock4,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { RichmondLogo } from '@/components/brand/richmond-logo';
import { HeroCalculator } from './hero-calculator';

export const dynamic = 'force-dynamic';

/**
 * Public landing — mobile-first, conversion-focused. The top fold on a
 * phone is: brand strip, one-line value prop, the live calculator. Below
 * the fold: live partner-employer cards, trust strip, FAQ, contact.
 * Branding follows the live richmond-afri.com identity (crimson #8b1e24,
 * warm neutral surfaces, Inter wordmark, official logo).
 */
export default async function LandingPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: employers } = await supabase
    .from('employers')
    .select('id, legal_name, trading_name, slug')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('legal_name', { ascending: true })
    .limit(8);

  const partners = employers ?? [];
  const tel = '+260965503484';
  const wa = `https://wa.me/${tel.replace(/[^\d]/g, '')}`;

  return (
    <main className="flex min-h-screen flex-col bg-surface-base">
      <header className="sticky top-0 z-20 border-b border-ink-muted/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Richmond Finance" className="flex items-center">
            <RichmondLogo height={32} />
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-ink-muted/20 px-4 py-1.5 text-xs font-medium text-ink-base transition hover:border-richmond-primary hover:text-richmond-primary"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-surface-base to-surface-muted">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-2 lg:items-start">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-richmond-primary">
              Finance · Insurance · Advisory
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink-base sm:text-4xl lg:text-5xl">
              Loans for Zambian{' '}
              <span className="text-richmond-primary">employees</span>, repaid from payroll.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base text-ink-muted lg:mx-0">
              Apply on your phone in minutes. No paperwork. Your employer confirms the deduction in
              parallel — funds disbursed to your bank account or mobile money.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/apply"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-richmond-primary px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-richmond-primary-dark sm:w-auto"
              >
                Apply now <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={wa}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-muted/20 bg-white px-6 py-4 text-base font-semibold text-ink-base transition hover:border-richmond-primary hover:text-richmond-primary sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp us
              </a>
            </div>
            <ul className="mt-6 grid grid-cols-3 gap-3 text-[11px] text-ink-muted sm:gap-6">
              <Trust icon={<Clock4 className="h-4 w-4" />} text="Apply in minutes" />
              <Trust icon={<ShieldCheck className="h-4 w-4" />} text="BoZ-compliant" />
              <Trust icon={<CheckCircle2 className="h-4 w-4" />} text="No hidden fees" />
            </ul>
          </div>

          <HeroCalculator />
        </div>
      </section>

      {/* ─── EMPLOYERS ────────────────────────────────────────────────────── */}
      <section className="border-t border-ink-muted/10 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h2 className="text-center text-xl font-semibold text-ink-base sm:text-2xl">
            Already partnered with your employer?
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Tap your company to start. If you don&apos;t see it,{' '}
            <a href={wa} className="font-medium text-richmond-primary hover:underline">
              message us on WhatsApp
            </a>{' '}
            and we&apos;ll onboard them.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {partners.length > 0 ? (
              partners.map((e) => (
                <Link
                  key={e.id}
                  href={`/apply/${e.slug}`}
                  className="group flex items-center justify-between rounded-xl border border-ink-muted/10 bg-surface-muted px-4 py-3 transition hover:border-richmond-primary hover:bg-white"
                >
                  <div>
                    <div className="text-sm font-medium text-ink-base group-hover:text-richmond-primary">
                      {e.trading_name ?? e.legal_name}
                    </div>
                    <div className="text-[11px] text-ink-muted">{e.legal_name}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-muted group-hover:text-richmond-primary" />
                </Link>
              ))
            ) : (
              <p className="col-span-full text-center text-sm text-ink-muted">
                No partner employers yet — message us to get yours added.
              </p>
            )}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/apply"
              className="text-sm font-medium text-richmond-primary hover:underline"
            >
              See all partner employers →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="bg-surface-base">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-center text-xl font-semibold text-ink-base sm:text-2xl">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step n="1" title="Apply on your phone" body="Six short steps. Upload payslips. Sign the agreement digitally." />
            <Step n="2" title="We verify" body="Richmond runs due diligence; your employer confirms the deduction — in parallel, not in series." />
            <Step n="3" title="Money lands" body="Funds disbursed to your bank or mobile money. Repaid monthly from your salary." />
          </div>
        </div>
      </section>

      {/* ─── BOTTOM CTA + CONTACT ─────────────────────────────────────────── */}
      <section className="bg-richmond-primary text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:px-6">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Ready when you are.</h2>
            <p className="mt-1 text-sm text-white/80">Apply in under 15 minutes from your phone.</p>
          </div>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-richmond-primary transition hover:bg-white/90"
          >
            Apply now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-muted/10 bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm text-ink-muted sm:grid-cols-3 sm:px-6">
          <div>
            <RichmondLogo height={28} />
            <p className="mt-3 text-xs">
              Richmond Finance Limited
              <br />
              4th Floor Telecom House
              <br />
              Mwaimwena Road, Rhodes Park, Lusaka
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-base">Contact</p>
            <ul className="mt-2 space-y-2 text-xs">
              <li>
                <a href={`tel:${tel}`} className="inline-flex items-center gap-2 hover:text-richmond-primary">
                  <PhoneCall className="h-3 w-3" />
                  {tel}
                </a>
              </li>
              <li>
                <a href={wa} className="inline-flex items-center gap-2 hover:text-richmond-primary">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
              </li>
              <li>
                <a href="mailto:tpatel@richmond-fin.com" className="hover:text-richmond-primary">
                  tpatel@richmond-fin.com
                </a>
              </li>
              <li>
                <a href="https://www.richmond-afri.com" className="hover:text-richmond-primary">
                  www.richmond-afri.com
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-base">Legal</p>
            <ul className="mt-2 space-y-2 text-xs">
              <li>
                <Link href="/legal/signing-cert" className="hover:text-richmond-primary">
                  Signing certificate
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-richmond-primary">
                  Staff &amp; admin sign-in
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-[10px] text-ink-muted">
              Richmond Finance Limited is regulated by the Bank of Zambia.
            </p>
          </div>
        </div>
        <div className="border-t border-ink-muted/10 bg-surface-muted py-3 text-center text-[11px] text-ink-muted">
          © {new Date().getFullYear()} Richmond Finance Limited · Finance, Insurance &amp; Advisory
        </div>
      </footer>
    </main>
  );
}

function Trust({ icon, text }: { icon: React.ReactNode; text: string }): React.ReactElement {
  return (
    <li className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
      <span className="text-richmond-primary">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-ink-muted/10 bg-white p-5 shadow-sm">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-richmond-primary/10 text-sm font-bold text-richmond-primary">
        {n}
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink-base">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </div>
  );
}
