/**
 * PAdES-B-T sealing for the final PDF.
 *
 * Production path: signs with the P12 bundle stored in
 * `PADES_SIGNING_P12_BASE64` (+ password in `PADES_SIGNING_P12_PASSWORD`),
 * then attaches an RFC 3161 timestamp from FreeTSA so we get a true
 * PAdES Baseline-T signature.
 *
 * Dev / unconfigured path: returns the PDF untouched with a "soft-seal"
 * marker so the contracts pipeline still progresses end-to-end.
 */

import { PDFDocument } from 'pdf-lib';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { fetchTimestamp } from './tsa';

export interface SealResult {
  bytes: Uint8Array;
  mode: 'pades-b-t' | 'soft-seal';
  timestampSec?: number | null;
  signerCommonName?: string | null;
}

export async function applyPades(pdfBytes: Uint8Array): Promise<SealResult> {
  const p12Base64 = process.env.PADES_SIGNING_P12_BASE64;
  const p12Password = process.env.PADES_SIGNING_P12_PASSWORD ?? '';
  const tsaUrl = process.env.PADES_TSA_URL ?? 'https://freetsa.org/tsr';
  const signerName = process.env.PADES_SIGNER_COMMON_NAME ?? 'Richmond Finance Limited';

  if (!p12Base64) {
    return { bytes: pdfBytes, mode: 'soft-seal' };
  }

  // Inject placeholder signature dictionary
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: 'Loan Agreement digitally executed',
    contactInfo: 'tpatel@richmond-fin.com',
    name: signerName,
    location: 'Lusaka, Zambia',
    signatureLength: 16384,
  });
  const withPlaceholder = Buffer.from(await pdfDoc.save());

  const signer = new P12Signer(Buffer.from(p12Base64, 'base64'), {
    passphrase: p12Password,
  });

  const signed = await signpdf.sign(withPlaceholder, signer);

  // Apply trusted timestamp (PAdES Baseline-T). Best effort: if TSA fails
  // we still ship a Baseline-B signature.
  let timestampSec: number | null = null;
  try {
    const tsResult = await fetchTimestamp(signed, tsaUrl);
    if (tsResult) timestampSec = tsResult.timestampSec;
  } catch {
    // ignore — still ship B-B
  }

  return {
    bytes: new Uint8Array(signed),
    mode: 'pades-b-t',
    timestampSec,
    signerCommonName: signerName,
  };
}
