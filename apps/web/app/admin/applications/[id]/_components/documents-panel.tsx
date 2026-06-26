import { FileText, ExternalLink, CircleAlert } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APPLY_DOCUMENT_TYPES, type ApplyDocumentType, formatZmw, formatLusakaDateTime } from '@eplp/shared';

const DOC_LABELS: Record<ApplyDocumentType, string> = {
  nrc_front: 'NRC — front',
  nrc_back: 'NRC — back',
  photo: 'Photo of borrower',
  employment_contract: 'Employment contract',
  payslip_1: 'Payslip — last month',
  payslip_2: 'Payslip — two months ago',
  payslip_3: 'Payslip — three months ago',
  bank_proof: 'Bank statement or debit card',
};

const PAYSLIP_TYPES = new Set<ApplyDocumentType>(['payslip_1', 'payslip_2', 'payslip_3']);

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

interface OcrRow {
  doc_type: ApplyDocumentType;
  gross_ngwee: number | null;
  basic_ngwee: number | null;
  paye_ngwee: number | null;
  napsa_ngwee: number | null;
  nhima_ngwee: number | null;
  net_ngwee: number | null;
  period_month: string | null;
  confidence: number | null;
  status: 'ok' | 'failed';
  error_message: string | null;
  created_at: string;
}

export async function DocumentsPanel({
  applicationId,
}: {
  applicationId: string;
}): Promise<React.ReactElement> {
  const supabase = await createSupabaseServer();

  const [{ data: docRows }, { data: ocrRows }] = await Promise.all([
    supabase
      .from('application_documents')
      .select('id, doc_type, storage_path, created_at, verified_at')
      .eq('application_id', applicationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('application_payslip_ocr')
      .select(
        'doc_type, gross_ngwee, basic_ngwee, paye_ngwee, napsa_ngwee, nhima_ngwee, net_ngwee, period_month, confidence, status, error_message, created_at',
      )
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false }),
  ]);

  // Latest doc row per type — borrower re-uploads insert a fresh row.
  const latestDoc = new Map<ApplyDocumentType, DocRow>();
  for (const r of (docRows ?? []) as DocRow[]) {
    if (!latestDoc.has(r.doc_type)) latestDoc.set(r.doc_type, r);
  }

  // Latest OCR per payslip slot.
  const latestOcr = new Map<ApplyDocumentType, OcrRow>();
  for (const r of (ocrRows ?? []) as OcrRow[]) {
    if (!latestOcr.has(r.doc_type)) latestOcr.set(r.doc_type, r);
  }

  const paths = Array.from(latestDoc.values()).map((r) => r.storage_path);
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
          Reload the page if a link expires. Payslip rows show the figures Claude vision read on
          upload — please cross-check against the file before passing the DD items.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-ink-muted/10">
          {APPLY_DOCUMENT_TYPES.map((docType) => {
            const row = latestDoc.get(docType);
            const url = row ? signedByPath.get(row.storage_path) : undefined;
            const ocr = PAYSLIP_TYPES.has(docType) ? latestOcr.get(docType) : undefined;
            return (
              <li key={docType} className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
                <div className="flex items-start gap-3">
                  {row ? (
                    <FileText className="mt-0.5 h-4 w-4 text-ink-muted" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 text-status-warning" />
                  )}
                  <div className="space-y-1">
                    <div className="font-medium text-ink-base">{DOC_LABELS[docType]}</div>
                    {row ? (
                      <div className="text-xs text-ink-muted">
                        Uploaded {formatLusakaDateTime(row.created_at)}
                        {row.verified_at ? ' · verified' : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-status-warning">Missing</div>
                    )}
                    {ocr ? <OcrSummary ocr={ocr} /> : null}
                  </div>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-richmond-primary hover:underline"
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

function OcrSummary({ ocr }: { ocr: OcrRow }): React.ReactElement {
  if (ocr.status === 'failed') {
    return (
      <div className="text-xs text-status-warning">
        Couldn&apos;t auto-read this payslip ({ocr.error_message ?? 'no detail'}). Cross-check manually.
      </div>
    );
  }
  const period = ocr.period_month ? ocr.period_month.slice(0, 7) : '—';
  return (
    <div className="text-xs text-ink-muted">
      <span className="text-ink-base">OCR · {period}</span>
      {' · gross '}
      {ocr.gross_ngwee != null ? formatZmw(Number(ocr.gross_ngwee)) : '—'}
      {' · net '}
      {ocr.net_ngwee != null ? formatZmw(Number(ocr.net_ngwee)) : '—'}
      {ocr.confidence != null ? ` · ${Math.round(Number(ocr.confidence) * 100)}% conf` : ''}
    </div>
  );
}
