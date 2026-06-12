import { CheckCircle2, XCircle } from 'lucide-react';
import { requireMasterAdmin } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage(): Promise<React.ReactElement> {
  await requireMasterAdmin();

  const env = process.env;
  const checks: { label: string; ok: boolean; detail: string }[] = [
    {
      label: 'PAdES hard-seal',
      ok: Boolean(env.PADES_SIGNING_P12_BASE64 && env.PADES_SIGNING_P12_PASSWORD),
      detail: env.PADES_SIGNING_P12_BASE64
        ? 'Signing certificate is configured; contracts get a real Adobe banner.'
        : 'Falling back to soft-seal — stamped signatures + Certificate of Completion only.',
    },
    {
      label: 'Public signing-cert PEM',
      ok: Boolean(env.NEXT_PUBLIC_SIGNING_CERT_PEM),
      detail: env.NEXT_PUBLIC_SIGNING_CERT_PEM
        ? 'Published at /legal/signing-cert for external verifiers.'
        : 'Verifier page shows the placeholder PEM.',
    },
    {
      label: 'Sentry',
      ok: Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
      detail:
        env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN
          ? 'Error capture wired through.'
          : 'Errors are silently dropped — set SENTRY_DSN to enable.',
    },
    {
      label: 'Portal URL',
      ok: Boolean(env.NEXT_PUBLIC_PORTAL_URL),
      detail: env.NEXT_PUBLIC_PORTAL_URL ?? '(unset — verify links in PDFs and emails will be incomplete)',
    },
    {
      label: 'Signing cert public URL',
      ok: Boolean(env.NEXT_PUBLIC_SIGNING_CERT_URL),
      detail: env.NEXT_PUBLIC_SIGNING_CERT_URL ?? '(unset)',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-base">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Runtime configuration sourced from environment variables on the
          deployment. Read-only — change values via the hosting provider
          (Fly secrets) and the app will pick them up on restart.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integration health</CardTitle>
          <CardDescription>What is wired up and what is in fallback mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-3 border-b border-ink-muted/10 pb-3 last:border-0 last:pb-0">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-status-success" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 text-status-warning" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-ink-base">{c.label}</div>
                <div className="text-xs text-ink-muted">{c.detail}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
