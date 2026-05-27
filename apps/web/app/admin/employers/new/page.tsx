import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { EmployerForm } from './employer-form';

export const dynamic = 'force-dynamic';

export default function NewEmployerPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/employers"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to employers
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">New employer</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Configure the lending economics — every value here drives the per-loan calculations for
          this employer&apos;s employees.
        </p>
      </div>
      <EmployerForm />
    </div>
  );
}
