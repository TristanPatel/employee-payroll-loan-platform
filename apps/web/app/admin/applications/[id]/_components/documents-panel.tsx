import { FileText, ExternalLink, CircleAlert } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APPLY_DOCUMENT_TYPES, type ApplyDocumentType } from '@eplp/shared';
import { formatLusakaDateTime } from '@eplp/shared';

const DOC_LABELS: Record<ApplyDocumentType, string> = {
  nrc_front: 'NRC — front',
  nrc_back: 'NRC — back',
  photo: 'Photo of borrower',
  employment_contract: 'Employment contract',
  payslip_1: 'Payslip — most recent',
  payslip_2: 'Payslip — 2 months ago',
  payslip_3: 'Payslip — 3 months ago',
  bank_proof: 'Proof of banking',
  residence_proof: 'Proof of residence',
};

// 10 minutes is short enough that a link can't be casually shared, long
// enough that the checker can open a document and flip back without it
// expiring mid-review.
const SIGNED_URL_TTL_S = 600;

interface DocRow {
  id: string;
  doc_type: ApplyDocumentType;
  storage_path: string;
  created_at: string;
  verified_at: string | null;
}

export async function DocumentsPanel({
  applicationId,
}: {
  applicationId: string;
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from('application_documents')
    .select('id, doc_type, storage_path, created_at, verified_at')
    .eq('application_id', applicationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // The borrower re-upload path can leave more than one row per doc_type
  // (RLS doesn't let them soft-delete an old row), so dedupe to the latest.
  const latestByType = new Map<ApplyDocumentType, DocRow>();
  for (const r of (rows ?? []) as DocRow[]) {
    if (!latestByType.has(r.doc_type)) latestByType.set(r.doc_type, r);
  }

  const paths = Array.from(latestByType.values()).map((r) => r.storage_path);
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('application-docs')
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Borrower documents</CardTitle>
        <CardDescription>
          Each link is a short-lived signed URL ({Math.round(SIGNED_URL_TTL_S / 60)}-minute expiry).
          Reload the page if a link expires.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-ink-muted/10">
          {APPLY_DOCUMENT_TYPES.map((docType) => {
            const row = latestByType.get(docType);
            const url = row ? signedByPath.get(row.storage_path) : undefined;
            return (
              <li key={docType} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="flex items-center gap-3">
                  {row ? (
                    <FileText className="h-4 w-4 text-ink-muted" />
                  ) : (
                    <CircleAlert className="h-4 w-4 text-status-warning" />
                  )}
                  <div>
                    <div className="font-medium text-ink-base">{DOC_LABELS[docType]}</div>
                    {row ? (
                      <div className="text-xs text-ink-muted">
                        Uploaded {formatLusakaDateTime(row.created_at)}
                        {row.verified_at ? ' · verified' : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-status-warning">Missing</div>
                    )}
                  </div>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-richmond-primary hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
