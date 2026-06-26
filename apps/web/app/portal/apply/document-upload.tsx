'use client';

import { useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { APPLY_DOCUMENT_TYPES, type ApplyDocumentType } from '@eplp/shared';
import { cn } from '@/lib/cn';

const DOC_LABELS: Record<ApplyDocumentType, string> = {
  nrc_front: 'NRC — front',
  nrc_back: 'NRC — back',
  photo: 'Photo of yourself',
  employment_contract: 'Employment contract',
  payslip_1: 'Payslip — most recent',
  payslip_2: 'Payslip — 2 months ago',
  payslip_3: 'Payslip — 3 months ago',
  bank_proof: 'Proof of banking',
  residence_proof: 'Proof of residence',
};

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'done'; path: string }
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
    // Register the file in application_documents so checkers can find it.
    // The storage policies grant employer access via a JOIN on this table —
    // without the row, no one but Richmond staff and the borrower can read
    // the object, and the checker UI has no list to render. Re-uploads
    // insert a new row (borrowers don't have UPDATE on this table) so the
    // admin view dedupes by (application_id, doc_type) picking the most
    // recent created_at.
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
    setUploads((u) => ({ ...u, [docType]: { status: 'done', path } }));
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
                  <div className="text-xs text-status-success">Uploaded</div>
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
