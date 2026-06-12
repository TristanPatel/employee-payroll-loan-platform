import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic so NEXT_PUBLIC_SIGNING_CERT_PEM is read from the runtime
// environment (Fly secret) rather than frozen at image build time.
export const dynamic = 'force-dynamic';

// Publishes the Richmond Finance signing certificate's PUBLIC KEY in PEM
// form so external parties can verify the PAdES-B-T seal on any sealed
// contract PDF.

export default function SigningCertPage(): React.ReactElement {
  const publicPem = process.env.NEXT_PUBLIC_SIGNING_CERT_PEM ?? PLACEHOLDER_PEM;

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-ink-muted/10 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-richmond-primary text-sm font-bold text-white">
              RF
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-base">Richmond Finance</div>
              <div className="text-xs text-ink-muted">Document signing certificate</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink-base">Signing certificate</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Use this public key to verify the PAdES Baseline-T cryptographic seal applied
            to every Richmond Finance contract sealed via the Employee Payroll Loan Portal.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Public certificate (PEM)</CardTitle>
            <CardDescription>
              Rotate annually — see the cert-rotation runbook in our internal docs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md border border-ink-muted/10 bg-surface-base p-4 font-mono text-[11px] text-ink-base">
{publicPem}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to verify a sealed contract</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-base">
              <li>
                Download the sealed PDF and open it in Adobe Acrobat Reader (or any reader
                that supports PAdES signatures).
              </li>
              <li>
                The signature panel should display &ldquo;Signed by Richmond Finance Limited&rdquo;
                with a tamper-evidence banner.
              </li>
              <li>
                The embedded RFC 3161 trusted timestamp confirms when the document was
                sealed — independent of Richmond&apos;s server clock.
              </li>
              <li>
                Cross-check the contract&apos;s public verifier at{' '}
                <code className="text-xs">portal.richmond-afri.com/verify/&#123;contract_id&#125;</code>
                — every signatory&apos;s envelope SHA-256 must match the value in the
                certificate-of-completion page appended to the PDF.
              </li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-ink-muted">
          Verification queries: tpatel@richmond-fin.com · +260 965 503 484
        </p>
      </div>
    </main>
  );
}

const PLACEHOLDER_PEM = `-----BEGIN PLACEHOLDER-----
The Richmond Finance signing certificate has not yet been provisioned in
this deployment. While this placeholder is showing, contracts use the
soft-seal fallback (signatures stamped, hash recorded) without the
cryptographic PAdES banner.
-----END PLACEHOLDER-----`;
