import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Application pipeline CSV. */
export async function GET(): Promise<NextResponse> {
  await requireRole(['master_admin', 'cfo', 'accounts', 'auditor', 'branch_manager', 'cse']);
  const supabase = await createSupabaseServer();

  const { data: apps } = await supabase
    .from('loan_applications')
    .select(
      `application_no, status, tier, product, application_type,
       requested_amount_ngwee, requested_tenure_months, monthly_interest_rate,
       submitted_at, decision_at,
       employers ( legal_name ), branches ( branch_code )`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const header = [
    'application_no', 'status', 'tier', 'product', 'type', 'employer', 'branch',
    'amount_zmw', 'tenure_months', 'monthly_rate_pct', 'submitted_at', 'decision_at',
  ];
  const lines = [header.join(',')];
  for (const a of apps ?? []) {
    lines.push(
      [
        csv(a.application_no), csv(a.status), csv(a.tier), csv(a.product), csv(a.application_type),
        csv((a.employers as { legal_name?: string } | null)?.legal_name),
        csv((a.branches as { branch_code?: string } | null)?.branch_code),
        (Number(a.requested_amount_ngwee ?? 0) / 100).toFixed(2),
        String(a.requested_tenure_months),
        (Number(a.monthly_interest_rate) * 100).toFixed(2),
        csv(a.submitted_at), csv(a.decision_at),
      ].join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="richmond-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
