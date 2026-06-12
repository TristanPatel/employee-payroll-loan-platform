/**
 * Generate the Loan Application Part A PDF for a submitted application.
 *
 * Invoked from the web server action after submitApplication() succeeds.
 * Caller passes their bearer token (RLS scopes the SELECT to the borrower).
 *
 * Output:
 *   • PDF uploaded to contracts/{application_id}/part-a-v1.pdf
 *   • Returns the storage path + SHA-256 hash so the caller can write
 *     contracts.document_storage_path + contracts.document_sha256.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

interface RequestBody {
  application_id: string;
}

const BUCKET = 'contracts';
const RICHMOND_RED = rgb(0.545, 0.118, 0.141); // #8b1e24 — richmond-afri.com --primary

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const body = (await req.json()) as RequestBody;
  if (!body.application_id) {
    return new Response(JSON.stringify({ error: 'application_id required' }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Service-role client for the write + the cross-table read (RLS would
  // otherwise prevent reading some staff-scoped joins). We re-check the
  // caller's identity via the JWT.
  const supabase = createClient(supabaseUrl, serviceRole);

  // Verify the JWT by asking Supabase to resolve the user.
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) {
    return new Response(JSON.stringify({ error: 'invalid session' }), { status: 401 });
  }

  // Pull the application + nested employer + employee + profile via service role.
  const { data: app, error: appErr } = await supabase
    .from('loan_applications')
    .select(
      `
      id, application_no, status, product, application_type,
      requested_amount_ngwee, requested_tenure_months, purpose,
      monthly_interest_rate, admin_fee_pct, insurance_fee_pct,
      net_pay_ngwee, existing_obligations_ngwee, debt_ratio_pct,
      submitted_at,
      employees ( id, employee_no, occupation, department,
                  salary_basic_ngwee, salary_allowances_ngwee,
                  bank_name, bank_branch, bank_account_no,
                  residential_address, residential_city, residential_province,
                  profiles ( id, full_name, nrc_no, phone, email, salutation,
                             first_name, middle_name, surname ) ),
      employers ( legal_name, trading_name, registration_no ),
      branches ( name, branch_code )
      `,
    )
    .eq('id', body.application_id)
    .maybeSingle();

  if (appErr || !app) {
    return new Response(JSON.stringify({ error: appErr?.message ?? 'application not found' }), {
      status: 404,
    });
  }

  // Authorisation: borrower can fetch their own; richmond_staff can fetch any.
  const employee = (app as any).employees;
  const isOwner = employee?.profiles?.id === userRes.user.id;
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userRes.user.id)
    .maybeSingle();
  const isStaff =
    callerProfile?.role &&
    ['master_admin', 'branch_manager', 'cse', 'approver_l1', 'approver_l2', 'accounts', 'cfo', 'auditor'].includes(
      callerProfile.role,
    );
  if (!isOwner && !isStaff) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  const pdfBytes = await buildPartAPdf(app as any);
  const sha256 = await sha256Hex(pdfBytes);
  const path = `${app.id}/part-a-v1.pdf`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadErr) {
    return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      storage_path: path,
      sha256,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fmtMoney(ngwee: number | null | undefined): string {
  if (ngwee === null || ngwee === undefined) return 'K —';
  const k = Number(ngwee) / 100;
  return `K ${k.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function buildPartAPdf(app: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  const left = 50;
  let y = height - 50;

  // ─── Letterhead bar
  page.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: RICHMOND_RED });
  page.drawText('RICHMOND FINANCE LIMITED', {
    x: left,
    y: height - 27,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Employee Payroll Loan Portal', {
    x: width - 220,
    y: height - 25,
    size: 10,
    font,
    color: rgb(1, 1, 1),
  });

  y = height - 70;
  page.drawText('LOAN APPLICATION — PART A', { x: left, y, size: 16, font: bold });
  y -= 24;
  page.drawText(
    `Application: ${app.application_no ?? app.id} · Submitted ${formatDate(app.submitted_at)}`,
    { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) },
  );

  y -= 30;

  // ─── Applicant
  y = section(page, font, bold, left, y, 'APPLICANT', [
    ['Full name', app.employees?.profiles?.full_name ?? ''],
    ['NRC', app.employees?.profiles?.nrc_no ?? ''],
    ['Phone', app.employees?.profiles?.phone ?? ''],
    ['Email', app.employees?.profiles?.email ?? ''],
    ['Residential', app.employees?.residential_address ?? ''],
  ]);

  // ─── Employment
  y = section(page, font, bold, left, y, 'EMPLOYMENT', [
    ['Employer', app.employers?.legal_name ?? ''],
    ['Employee no.', app.employees?.employee_no ?? ''],
    ['Occupation', app.employees?.occupation ?? ''],
    ['Department', app.employees?.department ?? ''],
    ['Basic salary', fmtMoney(app.employees?.salary_basic_ngwee)],
    ['Allowances', fmtMoney(app.employees?.salary_allowances_ngwee)],
  ]);

  // ─── Bank
  y = section(page, font, bold, left, y, 'BANK', [
    ['Bank', app.employees?.bank_name ?? ''],
    ['Branch', app.employees?.bank_branch ?? ''],
    ['Account no.', app.employees?.bank_account_no ?? ''],
  ]);

  // ─── Loan
  y = section(page, font, bold, left, y, 'LOAN', [
    ['Product', app.product ?? ''],
    ['Application type', app.application_type ?? ''],
    ['Requested amount', fmtMoney(app.requested_amount_ngwee)],
    ['Tenure', `${app.requested_tenure_months} months`],
    ['Monthly rate', `${(Number(app.monthly_interest_rate) * 100).toFixed(2)}%`],
    ['Admin fee', `${(Number(app.admin_fee_pct) * 100).toFixed(2)}%`],
    ['Insurance fee', `${(Number(app.insurance_fee_pct) * 100).toFixed(2)}%`],
    ['Existing obligations', fmtMoney(app.existing_obligations_ngwee)],
    ['Purpose', app.purpose ?? ''],
  ]);

  // ─── Declaration footer
  y -= 12;
  page.drawText(
    'I confirm that the information provided above is true and complete. I authorise',
    { x: left, y, size: 9, font, color: rgb(0.2, 0.2, 0.3) },
  );
  y -= 12;
  page.drawText(
    'my employer to deduct repayments from my salary in line with the loan agreement.',
    { x: left, y, size: 9, font, color: rgb(0.2, 0.2, 0.3) },
  );

  // ─── Footer
  page.drawLine({
    start: { x: left, y: 60 },
    end: { x: width - left, y: 60 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.85),
  });
  page.drawText(
    'Richmond Finance Limited · 4th Floor Telecom House, Mwaimwena Road, Rhodes Park, Lusaka · Reg No. 120180001942',
    { x: left, y: 46, size: 8, font, color: rgb(0.4, 0.4, 0.5) },
  );
  page.drawText('+260 965 503 484 · tpatel@richmond-fin.com · www.richmond-afri.com', {
    x: left,
    y: 34,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.5),
  });

  return await pdf.save();
}

function section(
  page: any,
  font: any,
  bold: any,
  left: number,
  startY: number,
  title: string,
  rows: [string, string][],
): number {
  let y = startY;
  page.drawText(title, { x: left, y, size: 10, font: bold, color: RICHMOND_RED });
  y -= 14;
  for (const [label, value] of rows) {
    page.drawText(label, { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) });
    page.drawText(value || '—', { x: left + 130, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.15) });
    y -= 14;
  }
  return y - 8;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lusaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}
