import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Loan book CSV — for BoZ submissions and management spreadsheets. */
export async function GET(): Promise<NextResponse> {
  await requireRole(['master_admin', 'cfo', 'accounts', 'auditor', 'branch_manager']);
  const supabase = await createSupabaseServer();

  const { data: loans } = await supabase
    .from('loans')
    .select(
      `loan_no, status, principal_ngwee, monthly_interest_rate, tenure_months,
       total_interest_ngwee, total_collectable_ngwee, monthly_installment_ngwee,
       disbursed_amount_ngwee, current_outstanding_ngwee,
       start_date, end_date, disbursed_at, disbursement_method,
       employers ( legal_name ), branches ( branch_code )`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const header = [
    'loan_no', 'status', 'employer', 'branch', 'principal_zmw', 'monthly_rate_pct',
    'tenure_months', 'total_interest_zmw', 'total_collectable_zmw',
    'monthly_installment_zmw', 'disbursed_zmw', 'outstanding_zmw',
    'start_date', 'end_date', 'disbursed_at', 'disbursement_method',
  ];
  const lines = [header.join(',')];
  for (const l of loans ?? []) {
    lines.push(
      [
        csv(l.loan_no), csv(l.status),
        csv((l.employers as { legal_name?: string } | null)?.legal_name),
        csv((l.branches as { branch_code?: string } | null)?.branch_code),
        money(l.principal_ngwee), (Number(l.monthly_interest_rate) * 100).toFixed(2),
        String(l.tenure_months), money(l.total_interest_ngwee),
        money(l.total_collectable_ngwee), money(l.monthly_installment_ngwee),
        money(l.disbursed_amount_ngwee), money(l.current_outstanding_ngwee),
        csv(l.start_date), csv(l.end_date), csv(l.disbursed_at), csv(l.disbursement_method),
      ].join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="richmond-loans-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function money(ngwee: unknown): string {
  return (Number(ngwee ?? 0) / 100).toFixed(2);
}
