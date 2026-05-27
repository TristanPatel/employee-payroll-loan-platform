/**
 * Build the final stamped PDF for a fully-signed contract:
 *   1. Reload the original document (Part A) bytes.
 *   2. Stamp each signature visibly on the last page of the original document
 *      (signature image + printed name + NRC + signed-at in Lusaka time).
 *   3. Append a "Certificate of Completion" page with the full evidence
 *      timeline + public verification URL + cryptographic hashes.
 *
 * Output is a finished PDF byte array suitable for the PAdES signer.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SignatureForStamp {
  role: string;
  name: string;
  nrc?: string | null;
  signedAtIso: string;
  imageBytes?: Uint8Array | null;
  ip?: string | null;
  userAgent?: string | null;
  authenticationMethod?: string | null;
  envelopeSha256: string;
  documentSha256AtSigning: string;
}

export interface CertificateInputs {
  contractId: string;
  contractType: string;
  templateKey: string;
  templateVersion: number;
  loanNo?: string | null;
  applicationNo?: string | null;
  verifyUrl: string;
  signingCertPublicUrl: string;
  signatures: SignatureForStamp[];
  auditEvents: { event_type: string; occurred_at: string }[];
}

const RICHMOND_RED = rgb(0.753, 0.224, 0.169);
const INK = rgb(0.1, 0.1, 0.15);
const MUTED = rgb(0.45, 0.45, 0.55);

export async function buildFinalPdf(
  originalPdfBytes: Uint8Array,
  cert: CertificateInputs,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Stamp each signature on a new appended page (so we don't disturb the
  // original layout). One signature per row, three per page.
  const stampPage = pdf.addPage([595.28, 841.89]);
  const { width, height } = stampPage.getSize();
  let y = height - 60;
  stampPage.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: RICHMOND_RED });
  stampPage.drawText('SIGNATURES', { x: 50, y: height - 27, size: 14, font: bold, color: rgb(1, 1, 1) });

  for (const sig of cert.signatures) {
    if (y < 200) {
      const more = pdf.addPage([595.28, 841.89]);
      y = more.getSize().height - 60;
    }
    const page = pdf.getPages().at(-1)!;
    page.drawText(sig.role.toUpperCase(), { x: 50, y, size: 9, font: bold, color: RICHMOND_RED });
    y -= 14;
    page.drawText(sig.name, { x: 50, y, size: 12, font: bold, color: INK });
    if (sig.nrc) {
      y -= 12;
      page.drawText(`NRC: ${sig.nrc}`, { x: 50, y, size: 9, font, color: MUTED });
    }
    y -= 12;
    page.drawText(`Signed: ${fmt(sig.signedAtIso)}`, { x: 50, y, size: 9, font, color: MUTED });
    y -= 10;
    page.drawText(`Envelope SHA-256: ${shorten(sig.envelopeSha256)}`, {
      x: 50, y, size: 8, font, color: MUTED,
    });

    // Signature image stamped on the right.
    if (sig.imageBytes) {
      try {
        const png = await pdf.embedPng(sig.imageBytes);
        const pngWidth = 180;
        const pngHeight = (png.height / png.width) * pngWidth;
        page.drawImage(png, { x: width - 50 - pngWidth, y: y - 20, width: pngWidth, height: pngHeight });
      } catch {
        // ignore — image not embeddable
      }
    }

    y -= 60;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 12;
  }

  // Watermark + sealed banner
  const lastSig = pdf.getPages().at(-1)!;
  lastSig.drawRectangle({
    x: 50, y: 100, width: width - 100, height: 36,
    color: rgb(0.96, 0.96, 0.98),
  });
  lastSig.drawText(
    'Digitally executed under the Electronic Communications and Transactions Act No. 4 of 2021 (Zambia).',
    { x: 60, y: 122, size: 9, font, color: INK },
  );
  lastSig.drawText(
    `Verification: ${cert.verifyUrl}`,
    { x: 60, y: 108, size: 9, font, color: RICHMOND_RED },
  );

  // ─── Certificate of Completion (its own page)
  const certPage = pdf.addPage([595.28, 841.89]);
  const cw = certPage.getSize().width;
  const ch = certPage.getSize().height;
  certPage.drawRectangle({ x: 0, y: ch - 40, width: cw, height: 40, color: RICHMOND_RED });
  certPage.drawText('CERTIFICATE OF COMPLETION', {
    x: 50, y: ch - 27, size: 14, font: bold, color: rgb(1, 1, 1),
  });

  let cy = ch - 70;
  certPage.drawText('Contract metadata', { x: 50, y: cy, size: 10, font: bold, color: RICHMOND_RED });
  cy -= 14;
  const certRows: [string, string][] = [
    ['Contract ID', cert.contractId],
    ['Type', cert.contractType],
    ['Template', `${cert.templateKey} v${cert.templateVersion}`],
    ['Application No.', cert.applicationNo ?? '—'],
    ['Loan No.', cert.loanNo ?? '—'],
    ['Verification URL', cert.verifyUrl],
    ['Signing cert URL', cert.signingCertPublicUrl],
  ];
  for (const [k, v] of certRows) {
    certPage.drawText(k, { x: 50, y: cy, size: 9, font, color: MUTED });
    certPage.drawText(v, { x: 200, y: cy, size: 9, font: bold, color: INK });
    cy -= 14;
  }

  cy -= 6;
  certPage.drawText('Signatories', { x: 50, y: cy, size: 10, font: bold, color: RICHMOND_RED });
  cy -= 14;
  for (const s of cert.signatures) {
    certPage.drawText(`${s.role}  ·  ${s.name}`, { x: 50, y: cy, size: 9, font: bold, color: INK });
    cy -= 12;
    certPage.drawText(
      `signed ${fmt(s.signedAtIso)}  ·  auth: ${s.authenticationMethod ?? '—'}  ·  ip: ${s.ip ?? '—'}`,
      { x: 60, y: cy, size: 8, font, color: MUTED },
    );
    cy -= 11;
    certPage.drawText(`envelope ${shorten(s.envelopeSha256)}`, {
      x: 60, y: cy, size: 8, font, color: MUTED,
    });
    cy -= 11;
    certPage.drawText(`document at signing ${shorten(s.documentSha256AtSigning)}`, {
      x: 60, y: cy, size: 8, font, color: MUTED,
    });
    cy -= 16;
  }

  cy -= 4;
  certPage.drawText('Timeline', { x: 50, y: cy, size: 10, font: bold, color: RICHMOND_RED });
  cy -= 14;
  for (const ev of cert.auditEvents) {
    if (cy < 80) break;
    certPage.drawText(`${fmt(ev.occurred_at)}  ·  ${ev.event_type}`, {
      x: 50, y: cy, size: 9, font, color: INK,
    });
    cy -= 12;
  }

  certPage.drawLine({
    start: { x: 50, y: 60 },
    end: { x: cw - 50, y: 60 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.9),
  });
  certPage.drawText(
    'Richmond Finance Limited · 4th Floor Telecom House, Mwaimwena Road, Rhodes Park, Lusaka',
    { x: 50, y: 46, size: 8, font, color: MUTED },
  );
  certPage.drawText('+260 965 503 484 · tpatel@richmond-fin.com · www.richmond-afri.com', {
    x: 50, y: 34, size: 8, font, color: MUTED,
  });

  return await pdf.save();
}

function shorten(hex: string): string {
  if (!hex) return '—';
  if (hex.length <= 18) return hex;
  return `${hex.slice(0, 10)}…${hex.slice(-8)}`;
}

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lusaka',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso)) + ' CAT';
  } catch {
    return iso;
  }
}
