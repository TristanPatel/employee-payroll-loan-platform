// supabase/functions/notification-worker/index.ts
//
// Drains queued SMS + email notifications.
//
//   POST /functions/v1/notification-worker
//
// Reads up to N rows where channel in ('sms','email') and status='queued',
// renders the template for that channel, calls the provider, then marks
// the row 'sent' (with sent_at) or 'failed' (with error). Idempotent —
// retried rows just stay queued until they succeed or are manually marked.
//
// Providers:
//   • SMS   — Twilio (env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//             TWILIO_FROM_NUMBER)
//   • Email — Resend (env: RESEND_API_KEY, RESEND_FROM_EMAIL)
//
// When provider env is missing for a channel, the row is left queued
// (no-op) and a console.warn is emitted. This lets ops deploy the
// function before configuring credentials.

import { createClient } from 'jsr:@supabase/supabase-js@^2.46.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TW_SID   = Deno.env.get('TWILIO_ACCOUNT_SID');
const TW_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TW_FROM  = Deno.env.get('TWILIO_FROM_NUMBER');

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@richmond-afri.com';

// ---- template renderer -----------------------------------------------------

interface Notification {
  id: string;
  recipient_id: string;
  channel: 'sms' | 'email' | 'in_app' | 'push';
  template: string;
  payload: Record<string, unknown>;
}

interface Rendered {
  subject?: string;
  body: string;
}

function render(n: Notification): Rendered {
  const p = n.payload;
  const appNo = (p.application_no as string | undefined) ?? '';
  const loanNo = (p.loan_no as string | undefined) ?? '';
  switch (n.template) {
    case 'application_approved':
      return {
        subject: `Loan application ${appNo} approved`,
        body: `Hi! Your Richmond Finance loan application ${appNo} has been approved. We'll be in touch with next steps. — Richmond Finance`,
      };
    case 'application_rejected':
      return {
        subject: `Loan application ${appNo} declined`,
        body: `Hi. Your Richmond Finance application ${appNo} was declined. Please contact your branch CSE for next steps. — Richmond Finance`,
      };
    case 'approval_progress':
      return {
        subject: `Loan application ${appNo} update`,
        body: `Your Richmond Finance application ${appNo} moved to ${String(p.next_status ?? 'next stage')}. — Richmond Finance`,
      };
    case 'loan_created':
      return {
        subject: `Loan ${loanNo} created`,
        body: `Your loan ${loanNo} has been created. Monthly instalment: K${
          (Number(p.monthly_installment_ngwee ?? 0) / 100).toLocaleString('en-ZM')
        }. Starts ${String(p.start_date ?? '')}. — Richmond Finance`,
      };
    case 'loan_disbursed':
      return {
        subject: `Loan ${loanNo} disbursed`,
        body: `Your loan ${loanNo} of K${
          (Number(p.amount_ngwee ?? 0) / 100).toLocaleString('en-ZM')
        } has been disbursed via ${String(p.method ?? 'bank transfer')}. Ref: ${String(p.reference ?? '—')}. — Richmond Finance`,
      };
    default:
      return { body: `Update from Richmond Finance: ${n.template}` };
  }
}

// ---- providers -------------------------------------------------------------

async function sendSms(to: string, body: string): Promise<string> {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) throw new Error('Twilio not configured');
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TW_FROM, Body: body }),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? `Twilio ${res.status}`);
  return json.sid ?? '';
}

async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  if (!RESEND_KEY) throw new Error('Resend not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text: body,
    }),
  });
  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? `Resend ${res.status}`);
  return json.id ?? '';
}

// ---- worker ----------------------------------------------------------------

Deno.serve(async () => {
  // Pick up to 20 rows at a time
  const { data: queue, error: qErr } = await supabase
    .from('notifications')
    .select('id, recipient_id, channel, template, payload')
    .eq('status', 'queued')
    .in('channel', ['sms', 'email'])
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(20);
  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), { status: 500 });
  }
  if (!queue || queue.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pre-fetch recipient contact details
  const recipientIds = [...new Set(queue.map((n) => n.recipient_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone_e164')
    .in('id', recipientIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const results: { id: string; status: 'sent' | 'failed'; error?: string }[] = [];
  for (const n of queue as Notification[]) {
    const profile = byId.get(n.recipient_id);
    if (!profile) {
      results.push({ id: n.id, status: 'failed', error: 'recipient profile not found' });
      continue;
    }
    const r = render(n);
    try {
      let providerId: string;
      if (n.channel === 'sms') {
        if (!profile.phone_e164) throw new Error('no phone on profile');
        providerId = await sendSms(profile.phone_e164, r.body);
      } else {
        if (!profile.email) throw new Error('no email on profile');
        providerId = await sendEmail(profile.email, r.subject ?? 'Richmond Finance', r.body);
      }
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(),
                  payload: { ...n.payload, provider_id: providerId } })
        .eq('id', n.id);
      results.push({ id: n.id, status: 'sent' });
    } catch (err) {
      const message = (err as Error).message;
      // If provider not configured, leave queued so later drains succeed
      const isConfig = message.includes('not configured');
      await supabase
        .from('notifications')
        .update(isConfig
          ? {}  // leave queued
          : { status: 'failed', error: message })
        .eq('id', n.id);
      results.push({ id: n.id, status: 'failed', error: message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
