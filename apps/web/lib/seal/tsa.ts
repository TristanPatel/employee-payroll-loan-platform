/**
 * Minimal RFC 3161 trusted-timestamp client.
 *
 * Builds a TimeStampReq from the SHA-256 of the signed PDF and posts it
 * to the configured TSA (default FreeTSA). Returns the raw TimeStampResp
 * bytes + parsed signing time (seconds since epoch) so the caller can
 * embed it into the PAdES signature dictionary.
 *
 * This is a best-effort client — TSAs use ASN.1 DER encoding and the
 * full parsing is non-trivial. For the demo path we extract just the
 * GeneralizedTime from the response and skip strict cert-chain
 * validation (the seal still yields a Baseline-B PAdES on failure).
 */

import { createHash } from 'node:crypto';
import forge from 'node-forge';

export interface TsaResult {
  responseBytes: Uint8Array;
  timestampSec: number;
}

export async function fetchTimestamp(
  signedPdfBytes: Buffer,
  tsaUrl: string,
): Promise<TsaResult | null> {
  const hash = createHash('sha256').update(signedPdfBytes).digest();

  // RFC 3161 TimeStampReq:
  // TimeStampReq ::= SEQUENCE {
  //   version  INTEGER  { v1(1) },
  //   messageImprint  MessageImprint,
  //   reqPolicy  TSAPolicyId  OPTIONAL,
  //   nonce  INTEGER  OPTIONAL,
  //   certReq  BOOLEAN  DEFAULT FALSE,
  //   extensions  [0] IMPLICIT Extensions  OPTIONAL  }
  const oidSha256 = '2.16.840.1.101.3.4.2.1';
  const messageImprint = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      // AlgorithmIdentifier
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer(oidSha256).getBytes(),
          ),
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
        ],
      ),
      // OCTET STRING: hash
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OCTETSTRING,
        false,
        forge.util.binary.raw.encode(new Uint8Array(hash)),
      ),
    ],
  );

  const req = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      // version
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.INTEGER,
        false,
        forge.asn1.integerToDer(1).getBytes(),
      ),
      messageImprint,
      // certReq = TRUE
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BOOLEAN,
        false,
        String.fromCharCode(0xff),
      ),
    ],
  );

  const reqDer = forge.asn1.toDer(req).getBytes();
  const reqBytes = Buffer.from(reqDer, 'binary');

  const res = await fetch(tsaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query' },
    body: reqBytes,
  });
  if (!res.ok) {
    return null;
  }
  const responseBuf = Buffer.from(await res.arrayBuffer());

  // Best-effort GeneralizedTime extraction: parse DER, walk for first
  // GeneralizedTime tag (0x18).
  let timestampSec = Math.floor(Date.now() / 1000);
  try {
    const parsed = walkForGeneralizedTime(responseBuf);
    if (parsed) timestampSec = parsed;
  } catch {
    // keep wall-clock fallback
  }

  return { responseBytes: new Uint8Array(responseBuf), timestampSec };
}

function walkForGeneralizedTime(buf: Buffer): number | null {
  // Linear scan for ASN.1 GeneralizedTime tag (0x18). Format: YYYYMMDDHHMMSS[.fff]Z
  for (let i = 0; i < buf.length - 15; i++) {
    if (buf[i] === 0x18) {
      const len = buf[i + 1];
      if (len === undefined || len < 12 || len > 32) continue;
      const slice = buf.subarray(i + 2, i + 2 + len).toString('ascii');
      const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(slice);
      if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6]) continue;
      const ms = Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6]),
      );
      if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
    }
  }
  return null;
}
