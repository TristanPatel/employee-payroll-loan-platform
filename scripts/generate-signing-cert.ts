#!/usr/bin/env tsx
/**
 * Generate a self-signed X.509 certificate for sealing Richmond Finance
 * contracts via PAdES-B-T. Outputs:
 *   • signing-cert-public.pem  — publish at /legal/signing-cert
 *   • signing-cert.p12         — load into Supabase Vault as a secret;
 *                                set PADES_SIGNING_P12_BASE64 from
 *                                `base64 -w 0 signing-cert.p12` and
 *                                PADES_SIGNING_P12_PASSWORD = the
 *                                passphrase chosen below.
 *
 * Validity: 2 years. Rotate at the 21-month mark via the same script
 * + a manifest entry in docs/legal/signing-cert-rotation.md.
 *
 * USAGE:
 *   pnpm tsx scripts/generate-signing-cert.ts \\
 *     --cn 'Richmond Finance Limited' \\
 *     --pass 'choose-a-strong-passphrase' \\
 *     --out  ./out
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import forge from 'node-forge';

interface Args {
  cn: string;
  pass: string;
  out: string;
  years: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? a[i + 1] : fallback;
  };
  return {
    cn: get('--cn', 'Richmond Finance Limited') ?? 'Richmond Finance Limited',
    pass: get('--pass') ?? requireEnv('SIGNING_CERT_PASSPHRASE'),
    out: get('--out', './out') ?? './out',
    years: Number(get('--years', '2')),
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing --pass or env ${key}`);
    process.exit(1);
  }
  return v;
}

function main(): void {
  const args = parseArgs();
  if (!existsSync(args.out)) mkdirSync(args.out, { recursive: true });

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Math.floor(Math.random() * 1e16).toString(16).padStart(16, '0');
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + args.years);

  const attrs = [
    { name: 'commonName', value: args.cn },
    { name: 'countryName', value: 'ZM' },
    { name: 'stateOrProvinceName', value: 'Lusaka' },
    { name: 'localityName', value: 'Lusaka' },
    { name: 'organizationName', value: 'Richmond Finance Limited' },
    { name: 'organizationalUnitName', value: 'Loan Portal' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // self-signed
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true },
    { name: 'extKeyUsage', codeSigning: true, emailProtection: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  writeFileSync(join(args.out, 'signing-cert-public.pem'), certPem, 'utf8');

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], args.pass, {
    algorithm: '3des',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  writeFileSync(join(args.out, 'signing-cert.p12'), Buffer.from(p12Der, 'binary'));

  const p12Base64 = Buffer.from(p12Der, 'binary').toString('base64');

  console.info('Done.');
  console.info(`  Public PEM: ${join(args.out, 'signing-cert-public.pem')}`);
  console.info(`  P12:        ${join(args.out, 'signing-cert.p12')}`);
  console.info('');
  console.info('Set these env vars on the Vercel project (or in Supabase Vault):');
  console.info(`  PADES_SIGNING_P12_BASE64=${p12Base64.slice(0, 80)}...`);
  console.info('  PADES_SIGNING_P12_PASSWORD=<the --pass value>');
  console.info('  NEXT_PUBLIC_SIGNING_CERT_PEM=<contents of signing-cert-public.pem>');
  console.info('');
  console.info('And publish signing-cert-public.pem at www.richmond-afri.com/legal/signing-cert.');
}

main();
