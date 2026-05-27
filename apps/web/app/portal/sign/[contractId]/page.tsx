import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignFlow } from './sign-flow';
import { formatLusakaDateTime } from '@eplp/shared';

export const dynamic = 'force-dynamic';

export default async function SignPage({
  params,
}: {
  params: { contractId: string };
}): Promise<React.ReactElement> {
  const profile = await getSessionProfile();
  if (!profile) notFound();

  const supabase = await createSupabaseServer();
  const { data: contract } = await supabase
    .from('contracts')
    .select(`id, contract_type, status, document_storage_path, document_sha256,
             required_signatories, fully_signed_at, voided_at, expires_at,
             application_id, created_at,
             loan_applications ( application_no, employers ( legal_name ) )`)
    .eq('id', params.contractId)
    .maybeSingle();

  if (!contract) notFound();

  // Who has already signed?
  const { data: existing } = await supabase
    .from('contract_signatures')
    .select('signatory_role, signed_at, signatory_name_snapshot')
    .eq('contract_id', contract.id)
    .order('signed_at', { ascending: true });

  // What role is the current signer playing?
  let myRole: 'borrower' | 'richmond_witness' | 'employer_signatory' | 'cfo' | null = null;
  if (profile.role === 'employee') myRole = 'borrower';
  else if (profile.role === 'employer_signatory') myRole = 'employer_signatory';
  else if (profile.role === 'cfo') myRole = 'cfo';
  else if (['master_admin', 'branch_manager', 'cse'].includes(profile.role)) myRole = 'richmond_witness';

  const alreadySignedRoles = new Set<string>((existing ?? []).map((r) => r.signatory_role));
  const requiredRoles = (contract.required_signatories ?? []) as string[];
  const canSign =
    myRole !== null && requiredRoles.includes(myRole) && !alreadySignedRoles.has(myRole) &&
    !['sealed', 'voided', 'expired'].includes(contract.status);

  const docDownload =
    contract.document_storage_path
      ? await supabase.storage.from('contracts').createSignedUrl(contract.document_storage_path, 900)
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/portal/my-application" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-richmond-primary">
        <ArrowLeft className="h-3 w-3" />
        Back
      </Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{contract.contract_type}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-base">
          Sign your loan agreement
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Application{' '}
          {(contract.loan_applications as { application_no?: string } | null)?.application_no ?? contract.application_id?.slice(0, 8)}
          {' · '}
          {(contract.loan_applications as { employers?: { legal_name?: string } } | null)?.employers?.legal_name ?? ''}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Signing status</CardTitle>
          <CardDescription>
            Status: <strong>{contract.status}</strong>
            {contract.fully_signed_at ? <> · Fully signed {formatLusakaDateTime(contract.fully_signed_at)}</> : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="pb-2 font-medium">Required signatory</th>
                <th className="pb-2 font-medium">Signed by</th>
                <th className="pb-2 font-medium">At</th>
              </tr>
            </thead>
            <tbody>
              {requiredRoles.map((role) => {
                const sig = (existing ?? []).find((e) => e.signatory_role === role);
                return (
                  <tr key={role} className="border-t border-ink-muted/5">
                    <td className="py-2 font-medium text-ink-base">{role}</td>
                    <td className="py-2 text-ink-muted">{sig?.signatory_name_snapshot ?? '—'}</td>
                    <td className="py-2 text-ink-muted">
                      {sig?.signed_at ? formatLusakaDateTime(sig.signed_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canSign && myRole ? (
        <SignFlow
          contractId={contract.id}
          signatoryRole={myRole}
          documentSha256={contract.document_sha256 ?? ''}
          documentUrl={docDownload?.data?.signedUrl ?? null}
          profileNrcHint={profile.nrc_no ? maskNrc(profile.nrc_no) : null}
        />
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-ink-muted">
              {myRole && alreadySignedRoles.has(myRole) ? (
                'You have already signed this contract for your role.'
              ) : myRole === null ? (
                'Your role is not part of this contract.'
              ) : !requiredRoles.includes(myRole) ? (
                'Your role is not required for this contract.'
              ) : (
                `This contract is ${contract.status}; signing is closed.`
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-ink-muted">
        Public verification:{' '}
        <Link href={`/verify/${contract.id}`} className="text-richmond-primary hover:underline">
          /verify/{contract.id.slice(0, 8)}…
        </Link>
      </p>
    </div>
  );
}

function maskNrc(nrc: string): string {
  if (nrc.length <= 4) return '****';
  return `${'*'.repeat(nrc.length - 3)}${nrc.slice(-3)}`;
}
