'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { APPLY_DOCUMENT_TYPES, type ApplyDocumentType } from '@eplp/shared';
import { cn } from '@/lib/cn';
import { ensureApplicationDraft } from './actions';

const DOC_LABELS: Record<ApplyDocumentType, string> = {
  nrc_front: 'NRC — front',
  nrc_back: 'NRC — back',
  photo: 'Photo of yourself',
  employment_contract: 'Employment contract',
  payslip_1: 'Payslip — last month',
  payslip_2: 'Payslip — two months ago',
  payslip_3: 'Payslip — three months ago',
  bank_proof: 'Bank statement or photo of your debit card',
};

const PAYSLIP_TYPES = new Set<ApplyDocumentType>(['payslip_1', 'payslip_2', 'payslip_3']);

interface OcrResult {
  ok: boolean;
  net_zmw: number | null;
  period_month: string | null;
  error?: string;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'done'; path: string; ocr?: 'pending' | OcrResult }
  | { status: 'error'; message: string };

export function DocumentUpload({ applicationId }: { applicationId: string }): React.ReactElement {
  const [uploads, setUploads] = useState<Partial<Record<ApplyDocumentType, UploadState>>>({});

  async function onPick(docType: ApplyDocumentType, file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploads((u) => ({ ...u, [docType]: { status: 'error', message: 'File too large (max 5 MB)' } }));
      return;
    }
    setUploads((u) => ({ ...u, [docType]: { status: 'uploading' } }));
    const supabase = getSupabaseBrowser();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      setUploads((u) => ({ ...u, [docType]: { status: 'error', message: 'Sign-in expired' } }));
      return;
    }
    // Idempotent — the first upload creates a draft loan_applications
    // row keyed by the wizard's UUID so the FKs on application_documents
    // and application_payslip_ocr are satisfied. Cheap on subsequent uploads.
    const draft = await ensureApplicationDraft(applicationId);
    if (draft.error) {
      setUploads((u) => ({ ...u, [docType]: { status: 'error', message: draft.error ?? 'Could not start your application.' } }));
      return;
    }
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${userRes.user.id}/${applicationId}/${docType}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('application-docs').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (uploadErr) {
      setUploads((u) => ({ ...u, [docType]: { status: 'error', message: uploadErr.message } }));
      return;
    }

    // Register in application_documents so the CSE panel can list the file
    // (storage RLS for the employer-side viewer also joins on this table).
    // Borrowers don't have UPDATE on this table; re-uploads insert a new
    // row and the admin view dedupes to the latest.
    const { error: rowErr } = await supabase.from('application_documents').insert({
      application_id: applicationId,
      doc_type: docType,
      storage_path: path,
      uploaded_by: userRes.user.id,
    });
    if (rowErr) {
      setUploads((u) => ({ ...u, [docType]: { status: 'error', message: rowErr.message } }));
      return;
    }

    setUploads((u) => ({
      ...u,
      [docType]: {
        status: 'done',
        path,
        ocr: PAYSLIP_TYPES.has(docType) ? 'pending' : undefined,
      },
    }));

    // Fire OCR for payslips. Fire-and-forget from the borrower's perspective;
    // we just update the row when it returns.
    if (PAYSLIP_TYPES.has(docType)) {
      try {
        const res = await fetch('/api/apply/payslip-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: applicationId,
            doc_type: docType,
            storage_path: path,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as OcrResult;
        setUploads((u) => ({
          ...u,
          [docType]: { status: 'done', path, ocr: { ...body, ok: Boolean(body.ok) } },
        }));
      } catch {
        setUploads((u) => ({
          ...u,
          [docType]: {
            status: 'done',
            path,
            ocr: { ok: false, net_zmw: null, period_month: null, error: 'could not read this payslip' },
          },
        }));
      }
    }
  }

  return (
    <ul className="space-y-2">
      {APPLY_DOCUMENT_TYPES.map((docType) => {
        const state = uploads[docType] ?? { status: 'idle' };
        return (
          <li
            key={docType}
            className={cn(
              'flex items-center justify-between rounded-md border border-ink-muted/15 bg-white px-4 py-3 text-sm',
              state.status === 'done' && 'border-status-success/40 bg-status-success/5',
              state.status === 'error' && 'border-status-danger/40 bg-status-danger/5',
            )}
          >
            <div className="flex items-center gap-3">
              {state.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-status-success" />
              ) : (
                <Upload className="h-4 w-4 text-ink-muted" />
              )}
              <div>
                <div className="font-medium text-ink-base">{DOC_LABELS[docType]}</div>
                {state.status === 'uploading' ? (
                  <div className="text-xs text-ink-muted">Uploading…</div>
                ) : state.status === 'done' ? (
                  <OcrInline ocr={state.ocr} />
                ) : state.status === 'error' ? (
                  <div className="text-xs text-status-danger">{state.message}</div>
                ) : (
                  <div className="text-xs text-ink-muted">PNG, JPG, or PDF · up to 5 MB</div>
                )}
              </div>
            </div>
            <label>
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={(e) => onPick(docType, e.target.files?.[0] ?? null)}
                disabled={state.status === 'uploading'}
              />
              <span className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-ink-muted/20 bg-white px-3 text-xs font-medium text-ink-base transition hover:bg-surface-muted">
                {state.status === 'done' ? 'Replace' : 'Choose'}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function OcrInline({ ocr }: { ocr: 'pending' | OcrResult | undefined }): React.ReactElement {
  if (ocr === undefined) {
    return <div className="text-xs text-status-success">Uploaded</div>;
  }
  if (ocr === 'pending') {
    return (
      <div className="flex items-center gap-1 text-xs text-ink-muted">
        <Loader2 className="h-3 w-3 animate-spin" /> Reading your payslip…
      </div>
    );
  }
  if (ocr.ok && ocr.net_zmw != null) {
    return (
      <div className="text-xs text-status-success">
        We read net pay: K {ocr.net_zmw.toLocaleString('en-ZM')}
        {ocr.period_month ? ` · ${ocr.period_month.slice(0, 7)}` : ''}
      </div>
    );
  }
  return (
    <div className="text-xs text-status-warning">
      Couldn&apos;t auto-read — your CSE will check this manually.
    </div>
  );
}
