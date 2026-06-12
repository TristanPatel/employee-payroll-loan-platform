// supabase/functions/notification-worker/index.ts
//
// Drains queued SMS + email + push notifications. POSTed every 5 minutes
// by pg_cron (see migration 23). Phase 9 adds Expo push support.

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

interface Notification {
  id: string; recipient_id: string;
  channel: 'sms' | 'email' | 'in_app' | 'push';
  template: string; payload: Record<string, unknown>;
}
interface Rendered { subject?: string; body: string }

function render(n: Notification): Rendered {
  const p = n.payload;
  const appNo = (p.application_no as string | undefined) ?? '';
  const loanNo = (p.loan_no as string | undefined) ?? '';
  switch (n.template) {
    case 'application_approved':
      return { subject: `Application ${appNo} approved`,
               body: `Your Richmond Finance application ${appNo} has been approved. — Richmond Finance` };
    case 'application_rejected':
      return { subject: `Application ${appNo} declined`,
               body: `Your Richmond Finance application ${appNo} was declined. — Richmond Finance` };
    case 'approval_progress':
      return { subject: `Application ${appNo} update`,
               body: `Application ${appNo} moved to ${String(p.next_status ?? 'next stage')}. — Richmond Finance` };
    case 'loan_created':
      return { subject: `Loan ${loanNo} created`,
               body: `Loan ${loanNo} created. Monthly: K${(Number(p.monthly_installment_ngwee ?? 0) / 100).toLocaleString('en-ZM')}. Starts ${String(p.start_date ?? '')}.` };
    case 'loan_disbursed':
      return { subject: `Loan ${loanNo} disbursed`,
               body: `Loan ${loanNo} of K${(Number(p.amount_ngwee ?? 0) / 100).toLocaleString('en-ZM')} disbursed via ${String(p.method ?? '')}. Ref ${String(p.reference ?? '')}.` };
    case 'repayment_received':
      return { subject: `Repayment received on ${loanNo}`,
               body: `K${(Number(p.amount_ngwee ?? 0) / 100).toLocaleString('en-ZM')} received on loan ${loanNo}. Outstanding: K${(Number(p.outstanding_ngwee ?? 0) / 100).toLocaleString('en-ZM')}.` };
    case 'loan_settled':
      return { subject: `Loan ${loanNo} fully settled`,
               body: `Your loan ${loanNo} is fully settled. Congratulations. — Richmond Finance` };
    case 'loan_closed':
    case 'loan_written_off':
      return { subject: `Loan ${loanNo} closed`,
               body: `Loan ${loanNo} closed. Reason: ${String(p.closure_reason ?? '—')}. — Richmond Finance` };
    default:
      return { body: `Update from Richmond Finance: ${n.template}` };
  }
}

// Twilio requires E.164. Zambian users typically store numbers as
// 097..., 26097..., or +26097... — normalise all of them to +260...
function toE164Zambia(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('260')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+260${cleaned.slice(1)}`;
  return `+260${cleaned}`;
}

async function sendSms(to: string, body: string): Promise<string> {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) throw new Error('Twilio not configured');
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toE164Zambia(to), From: TW_FROM, Body: body }),
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
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text: body }),
  });
  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? `Resend ${res.status}`);
  return json.id ?? '';
}

async function sendPush(token: string, subject: string, body: string): Promise<string> {
  if (!/^Exp(o|onent)PushToken\[/.test(token)) throw new Error('not an Expo push token');
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title: subject, body, sound: 'default' }),
  });
  const json = (await res.json()) as { data?: { id?: string; status?: string; message?: string } };
  const d = json.data;
  if (!res.ok || (d && d.status === 'error')) {
    throw new Error(d?.message ?? `Expo push ${res.status}`);
  }
  return d?.id ?? '';
}

Deno.serve(async () => {
  const { data: queue, error: qErr } = await supabase
    .from('notifications')
    .select('id, recipient_id, channel, template, payload')
    .eq('status', 'queued').in('channel', ['sms', 'email', 'push'])
    .is('deleted_at', null).order('created_at', { ascending: true }).limit(20);
  if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 });
  if (!queue || queue.length === 0)
    return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } });

  const recipientIds = [...new Set(queue.map((n) => n.recipient_id))];
  const { data: profiles } = await supabase
    .from('profiles').select('id, full_name, email, phone, expo_push_token').in('id', recipientIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const results: { id: string; status: 'sent' | 'failed'; error?: string }[] = [];
  for (const n of queue as Notification[]) {
    const profile = byId.get(n.recipient_id);
    if (!profile) { results.push({ id: n.id, status: 'failed', error: 'recipient profile not found' }); continue; }
    const r = render(n);
    try {
      let providerId: string;
      if (n.channel === 'sms') {
        if (!profile.phone) throw new Error('no phone on profile');
        providerId = await sendSms(profile.phone, r.body);
      } else if (n.channel === 'email') {
        if (!profile.email) throw new Error('no email on profile');
        providerId = await sendEmail(profile.email, r.subject ?? 'Richmond Finance', r.body);
      } else {
        if (!profile.expo_push_token) throw new Error('no push token on profile');
        providerId = await sendPush(profile.expo_push_token, r.subject ?? 'Richmond Finance', r.body);
      }
      await supabase.from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(),
                  payload: { ...n.payload, provider_id: providerId } })
        .eq('id', n.id);
      results.push({ id: n.id, status: 'sent' });
    } catch (err) {
      const message = (err as Error).message;
      const isConfig = message.includes('not configured');
      await supabase.from('notifications')
        .update(isConfig ? {} : { status: 'failed', error: message }).eq('id', n.id);
      results.push({ id: n.id, status: 'failed', error: message });
    }
  }
  return new Response(JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } });
});
