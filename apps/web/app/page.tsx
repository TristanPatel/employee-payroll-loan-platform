import Link from 'next/link';

export default function LandingPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-ink-muted/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-richmond-primary text-sm font-bold text-white">
              RF
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-base">Richmond Finance</div>
              <div className="text-xs text-ink-muted">Employee Payroll Loan Portal</div>
            </div>
          </div>
          <Link
            href="/sign-in"
            className="rounded-md bg-richmond-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-richmond-primary-dark"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="flex-1 bg-surface-base">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-base sm:text-5xl">
            Payroll-deduction loans for Zambian employees, end to end.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-muted">
            Apply online, get countersigned by your employer&apos;s HR, and have funds disbursed to
            your bank account or mobile money — without paper.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Card
              title="For employees"
              body="Apply for a loan from your mobile in minutes. Sign digitally. Track every instalment."
            />
            <Card
              title="For employers"
              body="Confirm employment, countersign pre-approvals, and reconcile monthly deductions."
            />
            <Card
              title="For Richmond Finance"
              body="Originate, approve, disburse, and manage repayments through one auditable system."
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-muted/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            Richmond Finance Limited &middot; 4th Floor Telecom House, Mwaimwena Road, Rhodes Park,
            Lusaka
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink-base">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink-base">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-ink-base">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-ink-muted/10 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-ink-base">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </div>
  );
}
