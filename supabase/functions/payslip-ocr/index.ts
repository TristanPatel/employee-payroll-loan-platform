// supabase/functions/payslip-ocr/index.ts
//
// OCR a freshly-uploaded payslip via Anthropic Claude vision, persist the
// extracted gross / basic / NAPSA / NHIMA / PAYE / net / period into
// public.application_payslip_ocr. Called fire-and-forget by the borrower's
// upload flow as soon as each payslip lands in storage.
//
// Soft-fail design: any failure (Claude API down, image unreadable, low
// confidence, JSON didn't validate) writes a row with status='failed' +
// error_message rather than nothing, so the CSE can see "we tried" and the
// audit trail is complete.
//
// Auth: the caller's anon-key JWT is in the Authorization header; we
// verify it and require the application to belong to them. The actual DB
// writes use the service-role key (RLS on application_payslip_ocr only
// allows writes by service_role).

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
  application_id: string;
  doc_type: 'payslip_1' | 'payslip_2' | 'payslip_3';
  storage_path: string;
}

interface ExtractedPayslip {
  gross_zmw: number | null;
  basic_zmw: number | null;
  paye_zmw: number | null;
  napsa_zmw: number | null;
  nhima_zmw: number | null;
  net_zmw: number | null;
  period_month: string | null;        // YYYY-MM-01
  employer_name: string | null;
  confidence: number;                 // 0..1
  notes?: string;
}

const STORAGE_BUCKET = 'application-docs';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function inferMediaType(path: string): { kind: 'image' | 'document'; mime: string } {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return { kind: 'document', mime: 'application/pdf' };
  if (lower.endsWith('.png')) return { kind: 'image', mime: 'image/png' };
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { kind: 'image', mime: 'image/jpeg' };
  if (lower.endsWith('.gif')) return { kind: 'image', mime: 'image/gif' };
  if (lower.endsWith('.webp')) return { kind: 'image', mime: 'image/webp' };
  // Best-effort fallback for unknown extensions: try as a PDF document.
  return { kind: 'document', mime: 'application/pdf' };
}

function zmwToNgwee(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

const EXTRACTION_TOOL = {
  name: 'extract_payslip',
  description:
    'Extract the headline figures from a Zambian payslip image or PDF. ' +
    'All cash figures must be the kwacha (ZMW) amount as a number (not text). ' +
    'period_month is the calendar month the payslip COVERS (the pay period), ' +
    'NOT the print date — formatted YYYY-MM-01 (first of that month). ' +
    'confidence reports how sure you are that the document is a Zambian payslip ' +
    'and the figures are right: 1.0 = clear, well-formed payslip; 0.5 = readable ' +
    'but some fields missing; below 0.3 = probably not a payslip.',
  input_schema: {
    type: 'object',
    properties: {
      gross_zmw:     { type: ['number', 'null'], description: 'Gross pay for the month in ZMW.' },
      basic_zmw:     { type: ['number', 'null'], description: 'Basic salary (before allowances) in ZMW.' },
      paye_zmw:      { type: ['number', 'null'], description: 'PAYE income tax deduction in ZMW.' },
      napsa_zmw:     { type: ['number', 'null'], description: 'NAPSA pension contribution in ZMW.' },
      nhima_zmw:     { type: ['number', 'null'], description: 'NHIMA health insurance deduction in ZMW.' },
      net_zmw:       { type: ['number', 'null'], description: 'Net take-home pay in ZMW after all deductions.' },
      period_month:  { type: ['string', 'null'], description: 'YYYY-MM-01 — first of the month the payslip covers.' },
      employer_name: { type: ['string', 'null'], description: 'Employer name printed on the payslip.' },
      confidence:    { type: 'number', minimum: 0, maximum: 1 },
      notes:         { type: 'string', description: 'Optional 1-line note about anything ambiguous.' },
    },
    required: ['confidence'],
  },
};

async function callClaude(
  base64: string, kind: 'image' | 'document', mime: string,
): Promise<ExtractedPayslip> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const content = [
    kind === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } }
      : { type: 'document', source: { type: 'base64', media_type: mime, data: base64 } },
    {
      type: 'text',
      text:
        'This is a Zambian employee payslip uploaded for a Richmond Finance loan ' +
        'application. Use the extract_payslip tool to return the headline figures. ' +
        'If the document is not a payslip (blurry photo, wrong file, NRC etc), set ' +
        'confidence below 0.3 and leave figure fields null.',
    },
  ];

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_payslip' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const block = (data.content as any[] | undefined)?.find((b) => b?.type === 'tool_use');
  if (!block?.input) {
    throw new Error('claude did not return tool_use');
  }
  return block.input as ExtractedPayslip;
}

async function downloadStorage(supabase: ReturnType<typeof createClient>, path: string): Promise<{ b64: string; mime: string; kind: 'image' | 'document' }> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) throw new Error(`storage download: ${error?.message ?? 'no data'}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  // Encode to base64 in chunks to avoid call-stack blowup on large files.
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  const b64 = btoa(bin);
  const { kind, mime } = inferMediaType(path);
  return { b64, kind, mime };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let body: RequestBody;
  try { body = (await req.json()) as RequestBody; }
  catch { return json(400, { error: 'invalid JSON' }); }

  if (!body.application_id || !/^[0-9a-f-]{36}$/i.test(body.application_id)) {
    return json(400, { error: 'application_id is required' });
  }
  if (!['payslip_1', 'payslip_2', 'payslip_3'].includes(body.doc_type)) {
    return json(400, { error: 'doc_type must be payslip_1, payslip_2 or payslip_3' });
  }
  if (!body.storage_path || typeof body.storage_path !== 'string') {
    return json(400, { error: 'storage_path is required' });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) return json(401, { error: 'sign-in required' });

  // Verify the caller via their JWT.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) return json(401, { error: 'invalid session' });
  const callerId = userRes.user.id;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Confirm the application belongs to the caller (via employee.profile_id).
  const { data: app } = await supabase
    .from('loan_applications')
    .select('id, employees!inner(profile_id)')
    .eq('id', body.application_id)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const ownerProfile = (app?.employees as any)?.profile_id;
  if (!app || ownerProfile !== callerId) {
    return json(403, { error: 'application not found or not yours' });
  }

  // Best-effort link to the most recent application_documents row for
  // this (application, doc_type) so the panel can join cleanly.
  const { data: doc } = await supabase
    .from('application_documents')
    .select('id')
    .eq('application_id', body.application_id)
    .eq('doc_type', body.doc_type)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const documentId = doc?.id ?? null;

  let extracted: ExtractedPayslip | null = null;
  let failedMsg: string | null = null;
  try {
    const { b64, kind, mime } = await downloadStorage(supabase, body.storage_path);
    extracted = await callClaude(b64, kind, mime);
  } catch (err) {
    failedMsg = (err as Error).message ?? 'ocr failed';
  }

  // Decide ok vs failed: low confidence is treated as failed so the UI
  // can tell the borrower we couldn't read it without inventing numbers.
  const lowConfidence = extracted != null && (extracted.confidence ?? 0) < 0.3;
  const isOk = extracted != null && !lowConfidence;

  const { error: insErr } = await supabase
    .from('application_payslip_ocr')
    .insert({
      application_id: body.application_id,
      document_id: documentId,
      doc_type: body.doc_type,
      gross_ngwee: isOk ? zmwToNgwee(extracted!.gross_zmw) : null,
      basic_ngwee: isOk ? zmwToNgwee(extracted!.basic_zmw) : null,
      paye_ngwee:  isOk ? zmwToNgwee(extracted!.paye_zmw)  : null,
      napsa_ngwee: isOk ? zmwToNgwee(extracted!.napsa_zmw) : null,
      nhima_ngwee: isOk ? zmwToNgwee(extracted!.nhima_zmw) : null,
      net_ngwee:   isOk ? zmwToNgwee(extracted!.net_zmw)   : null,
      period_month: isOk ? extracted!.period_month : null,
      employer_name: isOk ? extracted!.employer_name : null,
      confidence: extracted?.confidence ?? null,
      status: isOk ? 'ok' : 'failed',
      error_message: isOk
        ? null
        : failedMsg ?? (lowConfidence ? `low confidence (${extracted?.confidence ?? 0})` : 'could not read'),
      ocr_model: ANTHROPIC_MODEL,
    });
  if (insErr) {
    return json(500, { error: `ocr persist: ${insErr.message}` });
  }

  return json(200, {
    ok: isOk,
    status: isOk ? 'ok' : 'failed',
    net_zmw: isOk ? extracted!.net_zmw : null,
    period_month: isOk ? extracted!.period_month : null,
    employer_name: isOk ? extracted!.employer_name : null,
    confidence: extracted?.confidence ?? null,
    error: isOk ? undefined : (failedMsg ?? 'could not read this payslip'),
  });
});
