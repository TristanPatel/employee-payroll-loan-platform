import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { formatZmw } from '@eplp/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Richmond brand palette — matches packages/ui/src/tokens.ts, which is
// extracted from the richmond-afri.com CSS bundle (--primary: #8b1e24).
const RICHMOND_RED = rgb(0.545, 0.118, 0.141); // #8b1e24
const INK_BASE = rgb(0.13, 0.16, 0.18);
const INK_MUTED = rgb(0.36, 0.4, 0.44);
const ACCENT = rgb(0.35, 0.4, 0.44);
const SURFACE = rgb(0.97, 0.97, 0.96);
const RULE = rgb(0.85, 0.85, 0.85);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_L = 56;
const MARGIN_R = 56;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

/**
 * Dynamic Richmond-branded "System & Workflow Overview" PDF.
 *
 * Generated on demand from live database state. Every figure (employer
 * count, loan portfolio, sealed contracts, etc.) reflects production at
 * the moment of download — never a stale snapshot.
 *
 * Audience: BoZ inspectors, internal management review, on-boarding new
 * staff who need a one-document view of the platform.
 */
export async function GET(): Promise<NextResponse> {
  await requireRole(['master_admin', 'cfo', 'auditor', 'branch_manager']);
  const supabase = await createSupabaseServer();

  const [
    employersCount,
    branchesCount,
    profilesByRole,
    applicationsByStatus,
    loansByStatus,
    disbursedAgg,
    outstandingAgg,
    sealedContractsCount,
    notificationsAgg,
  ] = await Promise.all([
    supabase.from('employers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('branches').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('profiles').select('role').is('deleted_at', null),
    supabase.from('loan_applications').select('status'),
    supabase.from('loans').select('status'),
    supabase.from('loans').select('disbursed_amount_ngwee').neq('status', 'pending_disbursement'),
    supabase
      .from('loans')
      .select('current_outstanding_ngwee')
      .in('status', ['active', 'in_arrears']),
    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sealed'),
    supabase.from('notifications').select('channel, status'),
  ]);

  const roleCounts = countBy((profilesByRole.data ?? []).map((p) => p.role as string));
  const appCounts = countBy((applicationsByStatus.data ?? []).map((a) => a.status as string));
  const loanCounts = countBy((loansByStatus.data ?? []).map((l) => l.status as string));
  const totalDisbursed = (disbursedAgg.data ?? []).reduce(
    (s, r) => s + Number(r.disbursed_amount_ngwee ?? 0),
    0,
  );
  const totalOutstanding = (outstandingAgg.data ?? []).reduce(
    (s, r) => s + Number(r.current_outstanding_ngwee ?? 0),
    0,
  );
  const notifCounts = (notificationsAgg.data ?? []).reduce<Record<string, Record<string, number>>>(
    (acc, n) => {
      const ch = (n.channel as string) ?? '?';
      const st = (n.status as string) ?? '?';
      acc[ch] = acc[ch] ?? {};
      acc[ch][st] = (acc[ch][st] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const doc = await PDFDocument.create();
  doc.setTitle('Richmond Finance — System & Workflow Overview');
  doc.setAuthor('Richmond Finance Limited');
  doc.setProducer('Richmond EPLP');
  doc.setSubject('Employee Payroll Loan Portal — operational overview');

  const fonts = {
    body: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  // Official Richmond logo from public/ — same asset the site headers use.
  let logo: PDFImage | null = null;
  try {
    const png = await readFile(join(process.cwd(), 'public', 'richmond-logo.png'));
    logo = await doc.embedPng(new Uint8Array(png));
  } catch {
    // Logo missing in this build — header falls back to text-only.
  }

  const ctx: Ctx = { doc, fonts, logo, page: doc.addPage([PAGE_W, PAGE_H]), y: 0 };
  ctx.y = PAGE_H - 80;

  drawHeader(ctx, 'System & Workflow Overview');

  // -- Cover summary --------------------------------------------------------
  ctx.y -= 8;
  drawParagraph(
    ctx,
    'Richmond Finance Limited operates the Employee Payroll Loan Portal — a digital pipeline that takes a borrower from application through to repayment, with cryptographic contract sealing and full audit visibility for the Bank of Zambia. This document is generated on demand from the live database.',
    fonts.body,
    10,
    INK_MUTED,
  );
  ctx.y -= 8;
  drawMeta(ctx, [
    ['Generated', new Date().toLocaleString('en-ZM', { timeZone: 'Africa/Lusaka' })],
    ['Environment', process.env.NEXT_PUBLIC_PORTAL_URL ?? 'richmond-eplp-portal.fly.dev'],
    ['Supabase project', 'slmrpvlhttgrhoinpfwa'],
  ]);

  // -- Portfolio at a glance ------------------------------------------------
  drawSection(ctx, 'Portfolio at a glance');
  drawKpiGrid(ctx, [
    { label: 'Employers', value: String(employersCount.count ?? 0) },
    { label: 'Branches', value: String(branchesCount.count ?? 0) },
    { label: 'Accounts', value: String((profilesByRole.data ?? []).length) },
    { label: 'Active loans', value: String(loanCounts.active ?? 0) },
    { label: 'Sealed contracts', value: String(sealedContractsCount.count ?? 0) },
    { label: 'Lifetime disbursed', value: formatZmw(totalDisbursed) },
    { label: 'Outstanding', value: formatZmw(totalOutstanding) },
    { label: 'Pending disbursement', value: String(loanCounts.pending_disbursement ?? 0) },
  ]);

  // -- Workflow timeline ---------------------------------------------------
  ensureRoom(ctx, 280);
  drawSection(ctx, 'Loan lifecycle workflow');
  drawParagraph(
    ctx,
    'Each application flows through the same nine stages. Maker-checker is enforced at every approval and at disbursement. Once a contract is fully signed, sealing is irreversible.',
    fonts.body,
    10,
    INK_MUTED,
  );
  ctx.y -= 6;
  const stages: { name: string; actor: string; outcome: string }[] = [
    { name: '1. Apply', actor: 'Borrower', outcome: 'Application submitted (6-step wizard)' },
    { name: '2. Loan agreement signed', actor: 'Borrower + Richmond witness', outcome: 'Contract → fully_signed' },
    { name: '3. CSE due diligence', actor: 'CSE + Branch Manager', outcome: '12 checklist items + dual sign-off' },
    { name: '4. L1 approval', actor: 'Branch Manager / Approver L1', outcome: 'Status → l2_pending or approved' },
    { name: '5. L2 approval', actor: 'Master Admin / Approver L2', outcome: 'Status → l3_pending or approved' },
    { name: '6. L3 approval', actor: 'CFO', outcome: 'Status → approved; loan auto-created' },
    { name: '7. Disbursement', actor: 'Accounts (records) + 2nd staff (authorises)', outcome: 'Loan → active; net cash to borrower' },
    { name: '8. Monthly repayment', actor: 'Employer remittance batch', outcome: 'Schedule lines marked deducted' },
    { name: '9. Settlement / closure', actor: 'System trigger on full repayment', outcome: 'Loan → settled; statement generated' },
  ];
  drawWorkflowTable(ctx, stages);

  // -- Roles --------------------------------------------------------------
  ensureRoom(ctx, 220);
  drawSection(ctx, 'Roles & access');
  drawParagraph(
    ctx,
    'Live count of accounts per role. RLS in PostgreSQL enforces every read/write — there is no service-role usage in the browser-facing app.',
    fonts.body,
    10,
    INK_MUTED,
  );
  ctx.y -= 6;
  drawKvTable(ctx, [
    ['master_admin', String(roleCounts.master_admin ?? 0)],
    ['branch_manager', String(roleCounts.branch_manager ?? 0)],
    ['cse', String(roleCounts.cse ?? 0)],
    ['approver_l1', String(roleCounts.approver_l1 ?? 0)],
    ['approver_l2', String(roleCounts.approver_l2 ?? 0)],
    ['cfo', String(roleCounts.cfo ?? 0)],
    ['accounts', String(roleCounts.accounts ?? 0)],
    ['auditor', String(roleCounts.auditor ?? 0)],
    ['employer_admin / signatory', String((roleCounts.employer_admin ?? 0) + (roleCounts.employer_signatory ?? 0))],
    ['employee (borrowers)', String(roleCounts.employee ?? 0)],
  ]);

  // -- Application pipeline ------------------------------------------------
  ensureRoom(ctx, 200);
  drawSection(ctx, 'Application pipeline');
  drawKvTable(ctx, [
    ['Draft', String(appCounts.draft ?? 0)],
    ['Submitted', String(appCounts.submitted ?? 0)],
    ['CSE review', String(appCounts.cse_review ?? 0)],
    ['L1 pending', String(appCounts.l1_pending ?? 0)],
    ['L2 pending', String(appCounts.l2_pending ?? 0)],
    ['L3 pending', String(appCounts.l3_pending ?? 0)],
    ['Approved', String(appCounts.approved ?? 0)],
    ['Rejected', String(appCounts.rejected ?? 0)],
    ['Expired / withdrawn', String((appCounts.expired ?? 0) + (appCounts.withdrawn ?? 0))],
  ]);

  // -- Notifications ------------------------------------------------------
  ensureRoom(ctx, 180);
  drawSection(ctx, 'Notification delivery');
  drawParagraph(
    ctx,
    'SMS via Twilio (alphanumeric sender "Richmond"), email via Resend (loans.richmond-afri.com), in-app for all logged-in users. Push reserved for the mobile app.',
    fonts.body,
    10,
    INK_MUTED,
  );
  ctx.y -= 6;
  const channels = ['sms', 'email', 'in_app', 'push'];
  drawKvTable(
    ctx,
    channels.map((ch) => {
      const c = notifCounts[ch] ?? {};
      const sent = (c.sent ?? 0) + (c.delivered ?? 0);
      const queued = c.queued ?? 0;
      const failed = c.failed ?? 0;
      return [ch.toUpperCase(), `${sent} sent · ${queued} queued · ${failed} failed`];
    }),
  );

  // -- Compliance ---------------------------------------------------------
  ensureRoom(ctx, 200);
  drawSection(ctx, 'Compliance posture');
  const padesOn = Boolean(process.env.PADES_SIGNING_P12_BASE64);
  drawBulletList(ctx, [
    `PAdES Baseline-T cryptographic sealing: ${padesOn ? 'enabled' : 'soft-seal fallback'}.`,
    'Maker-checker enforced in every approval RPC and at disbursement.',
    'All RLS policies are role + scope based; advisor reports zero security findings.',
    'audit_log captures every INSERT/UPDATE on regulated tables.',
    'Daily backups for 7 days + 2-hour PITR (Supabase Pro).',
    `Public verifier at ${process.env.NEXT_PUBLIC_PORTAL_URL ?? '/verify'}/{contract_id} exposes only signatory names, roles, signed-at, and SHA-256 hashes — never PII.`,
  ]);

  // -- Recommendations ---------------------------------------------------
  ensureRoom(ctx, 240);
  drawSection(ctx, 'Recommendations');
  drawBulletList(ctx, [
    'Rotate the Twilio auth token, then update the Supabase Edge Function secret.',
    'Reset master-admin profile phone to the real production number (currently a test value).',
    'Enable leaked-password protection in Supabase Auth.',
    'Point Cloudflare CNAME portal.richmond-afri.com at richmond-eplp-portal.fly.dev and add the custom domain in Fly.',
    'Set SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN on Fly to capture errors.',
    'Onboard at least one real branch_manager via /admin/staff so disbursement maker-checker works without your own master_admin.',
    'Schedule a PITR restore drill in a Supabase branch before the next BoZ inspection.',
    'Build the EAS mobile app when borrowers ask for it; the Expo source is wired.',
  ]);

  // -- Footer on the last page ------------------------------------------
  drawFooter(ctx);

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="richmond-system-overview-${
        new Date().toISOString().slice(0, 10)
      }.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ── Drawing helpers ─────────────────────────────────────────────────────────

type Ctx = {
  doc: PDFDocument;
  page: ReturnType<PDFDocument['addPage']>;
  fonts: { body: import('pdf-lib').PDFFont; bold: import('pdf-lib').PDFFont; serif: import('pdf-lib').PDFFont };
  logo: PDFImage | null;
  y: number;
};

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - 56;
  // Slim red rule at the top of continuation pages
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: RICHMOND_RED });
  ctx.y -= 16;
}

function ensureRoom(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < 70) newPage(ctx);
}

function drawHeader(ctx: Ctx, subtitle: string): void {
  // Official logo (white-background PNG) sits on the white page top-left,
  // with the brand tagline beside it and a crimson rule underneath.
  const logoH = 56;
  const logoW = ctx.logo ? (logoH * ctx.logo.width) / ctx.logo.height : 0;
  if (ctx.logo) {
    ctx.page.drawImage(ctx.logo, {
      x: MARGIN_L - 8,
      y: PAGE_H - 24 - logoH,
      width: logoW,
      height: logoH,
    });
  }
  ctx.page.drawText('FINANCE, INSURANCE & ADVISORY', {
    x: MARGIN_L + logoW,
    y: PAGE_H - 52,
    size: 8,
    font: ctx.fonts.bold,
    color: INK_MUTED,
  });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 88, width: PAGE_W, height: 3, color: RICHMOND_RED });

  // Subtitle below the brand block
  ctx.y = PAGE_H - 116;
  ctx.page.drawText(subtitle, { x: MARGIN_L, y: ctx.y, size: 22, font: ctx.fonts.bold, color: INK_BASE });
  ctx.y -= 22;
  ctx.page.drawRectangle({ x: MARGIN_L, y: ctx.y, width: 40, height: 2, color: RICHMOND_RED });
  ctx.y -= 14;
}

function drawFooter(ctx: Ctx): void {
  const pages = ctx.doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Richmond Finance Limited · Finance, Insurance & Advisory · www.richmond-afri.com · Page ${i + 1} of ${pages.length}`, {
      x: MARGIN_L,
      y: 30,
      size: 8,
      font: ctx.fonts.body,
      color: INK_MUTED,
    });
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 4, color: RICHMOND_RED });
  });
}

function drawSection(ctx: Ctx, title: string): void {
  ensureRoom(ctx, 60);
  ctx.y -= 8;
  ctx.page.drawText(title, { x: MARGIN_L, y: ctx.y, size: 14, font: ctx.fonts.bold, color: INK_BASE });
  ctx.y -= 6;
  ctx.page.drawRectangle({ x: MARGIN_L, y: ctx.y, width: 28, height: 1.5, color: RICHMOND_RED });
  ctx.y -= 14;
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  color = INK_BASE,
): void {
  const lines = wrapText(text, font, size, CONTENT_W);
  for (const line of lines) {
    ensureRoom(ctx, size + 4);
    ctx.page.drawText(line, { x: MARGIN_L, y: ctx.y, size, font, color });
    ctx.y -= size + 3;
  }
}

function drawMeta(ctx: Ctx, rows: [string, string][]): void {
  ctx.y -= 4;
  ctx.page.drawRectangle({
    x: MARGIN_L,
    y: ctx.y - rows.length * 16 - 6,
    width: CONTENT_W,
    height: rows.length * 16 + 12,
    color: SURFACE,
  });
  ctx.y -= 4;
  for (const [k, v] of rows) {
    ctx.page.drawText(k.toUpperCase(), {
      x: MARGIN_L + 10,
      y: ctx.y - 12,
      size: 8,
      font: ctx.fonts.bold,
      color: INK_MUTED,
    });
    ctx.page.drawText(v, {
      x: MARGIN_L + 130,
      y: ctx.y - 12,
      size: 10,
      font: ctx.fonts.body,
      color: INK_BASE,
    });
    ctx.y -= 16;
  }
  ctx.y -= 6;
}

function drawKpiGrid(ctx: Ctx, items: { label: string; value: string }[]): void {
  const cols = 4;
  const cellW = (CONTENT_W - (cols - 1) * 8) / cols;
  const cellH = 50;
  const rows = Math.ceil(items.length / cols);
  ensureRoom(ctx, rows * (cellH + 8));
  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_L + col * (cellW + 8);
    const y = ctx.y - row * (cellH + 8) - cellH;
    ctx.page.drawRectangle({ x, y, width: cellW, height: cellH, color: SURFACE });
    ctx.page.drawRectangle({ x, y: y + cellH - 2, width: 16, height: 2, color: RICHMOND_RED });
    ctx.page.drawText(items[i]!.label.toUpperCase(), {
      x: x + 8,
      y: y + cellH - 14,
      size: 7,
      font: ctx.fonts.bold,
      color: INK_MUTED,
    });
    const value = items[i]!.value;
    const size = value.length > 10 ? 13 : 18;
    ctx.page.drawText(value, {
      x: x + 8,
      y: y + 10,
      size,
      font: ctx.fonts.bold,
      color: INK_BASE,
    });
  }
  ctx.y -= rows * (cellH + 8) + 6;
}

function drawKvTable(ctx: Ctx, rows: [string, string][]): void {
  for (const [k, v] of rows) {
    ensureRoom(ctx, 16);
    ctx.page.drawText(k, { x: MARGIN_L + 4, y: ctx.y - 10, size: 9, font: ctx.fonts.body, color: INK_BASE });
    ctx.page.drawText(v, {
      x: MARGIN_L + CONTENT_W - 4 - widthOf(v, ctx.fonts.bold, 9),
      y: ctx.y - 10,
      size: 9,
      font: ctx.fonts.bold,
      color: INK_BASE,
    });
    ctx.page.drawLine({
      start: { x: MARGIN_L, y: ctx.y - 14 },
      end: { x: MARGIN_L + CONTENT_W, y: ctx.y - 14 },
      thickness: 0.4,
      color: RULE,
    });
    ctx.y -= 16;
  }
  ctx.y -= 4;
}

function drawWorkflowTable(
  ctx: Ctx,
  stages: { name: string; actor: string; outcome: string }[],
): void {
  for (const s of stages) {
    ensureRoom(ctx, 28);
    ctx.page.drawCircle({ x: MARGIN_L + 4, y: ctx.y - 6, size: 3, color: RICHMOND_RED });
    ctx.page.drawText(s.name, {
      x: MARGIN_L + 14,
      y: ctx.y - 10,
      size: 10,
      font: ctx.fonts.bold,
      color: INK_BASE,
    });
    ctx.page.drawText(s.actor, {
      x: MARGIN_L + 14,
      y: ctx.y - 22,
      size: 8,
      font: ctx.fonts.body,
      color: ACCENT,
    });
    ctx.page.drawText(s.outcome, {
      x: MARGIN_L + 180,
      y: ctx.y - 16,
      size: 9,
      font: ctx.fonts.body,
      color: INK_MUTED,
    });
    ctx.page.drawLine({
      start: { x: MARGIN_L, y: ctx.y - 28 },
      end: { x: MARGIN_L + CONTENT_W, y: ctx.y - 28 },
      thickness: 0.3,
      color: RULE,
    });
    ctx.y -= 30;
  }
}

function drawBulletList(ctx: Ctx, items: string[]): void {
  for (const item of items) {
    ensureRoom(ctx, 24);
    ctx.page.drawCircle({ x: MARGIN_L + 4, y: ctx.y - 5, size: 2, color: RICHMOND_RED });
    const lines = wrapText(item, ctx.fonts.body, 10, CONTENT_W - 14);
    for (let i = 0; i < lines.length; i++) {
      ctx.page.drawText(lines[i]!, {
        x: MARGIN_L + 14,
        y: ctx.y - 10,
        size: 10,
        font: ctx.fonts.body,
        color: INK_BASE,
      });
      ctx.y -= 12;
    }
    ctx.y -= 4;
  }
}

function widthOf(s: string, font: import('pdf-lib').PDFFont, size: number): number {
  return font.widthOfTextAtSize(s, size);
}

function wrapText(
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function countBy(values: string[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const v of values) acc[v] = (acc[v] ?? 0) + 1;
  return acc;
}
