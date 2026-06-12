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

// Brand-wrapped HTML for every transactional Richmond email. Inline styles +
// table layout for max email-client compatibility. The crimson is #8b1e24
// (the same --primary the marketing site uses), and the wrapper ends with a
// short Richmond strap + WhatsApp CTA so each notification doubles as a
// gentle brand touch.
function brandHtml(subject: string, body: string): string {
  const logo = 'https://richmond-eplp-portal.fly.dev/richmond-logo.png';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f1ed;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2933;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ed;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
<tr><td style="background:#8b1e24;padding:18px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><img src="${logo}" alt="Richmond Finance" height="36" style="display:block;border:0;background:#ffffff;border-radius:6px;padding:4px 8px;"/></td>
<td align="right" style="color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Finance · Insurance · Advisory</td>
</tr></table></td></tr>
<tr><td style="padding:32px 32px 8px;"><h1 style="margin:0;font-size:20px;font-weight:600;color:#1f2933;line-height:1.3;">${escapeHtml(subject)}</h1></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:14px;color:#1f2933;line-height:1.6;">${body}</td></tr>
<tr><td style="background:#faf9f7;border-top:1px solid #e6e1da;padding:18px 32px;">
<p style="margin:0;font-size:12px;color:#5b6770;line-height:1.5;">Manage your loan, sign documents, and check next deductions on the Richmond portal.</p>
<p style="margin:10px 0 0;font-size:12px;">
<a href="https://richmond-eplp-portal.fly.dev" style="color:#8b1e24;text-decoration:none;font-weight:600;">Open the portal →</a>
&nbsp;&nbsp;
<a href="https://wa.me/260965503484" style="color:#8b1e24;text-decoration:none;font-weight:600;">WhatsApp us</a>
</p></td></tr>
<tr><td style="background:#1f2933;color:#cbd2d9;padding:16px 32px;font-size:11px;line-height:1.6;">
Richmond Finance Limited · 4th Floor Telecom House, Mwaimwena Road, Rhodes Park, Lusaka<br/>
<a href="tel:+260965503484" style="color:#cbd2d9;text-decoration:none;">+260 965 503 484</a> ·
<a href="https://www.richmond-afri.com" style="color:#cbd2d9;text-decoration:none;">www.richmond-afri.com</a> ·
Regulated by the Bank of Zambia
</td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  if (!RESEND_KEY) throw new Error('Resend not configured');
  // Render the plain-text body as branded HTML; preserve a text/plain
  // fallback so spam filters and old clients still get the message.
  const html = brandHtml(subject, `<p style="margin:0;">${escapeHtml(body).replace(/\n/g, '<br/>')}</p>`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Richmond Finance <${RESEND_FROM}>`,
      to: [to],
      subject,
      html,
      text: body,
    }),
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
