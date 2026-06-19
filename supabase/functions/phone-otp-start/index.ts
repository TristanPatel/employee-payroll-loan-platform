// supabase/functions/phone-otp-start/index.ts
//
// Borrower signup step 1: kick off a Twilio Verify SMS OTP for the supplied
// phone number. The phone is normalised to E.164 Zambian first; we cap to
// 5 starts per (phone, hour) at the database level as a belt to Twilio's
// braces. Each call writes one row into public.phone_otp_attempts.
//
// Twilio Verify is used (not Supabase's bundled phone provider) because it
// gives us full control over the UX wording, attempt accounting, and audit
// trail. The Verify Service SID + Auth credentials live in edge-function
// env vars; nothing leaves the function unless those are configured.

import { createClient } from 'jsr:@supabase/supabase-js@^2.46.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TW_SID       = Deno.env.get('TWILIO_ACCOUNT_SID');
const TW_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN');
const TW_VERIFY    = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

const STARTS_PER_HOUR = 5;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toE164Zambia(raw: string): string | null {
  const cleaned = (raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  let v: string;
  if (cleaned.startsWith('+')) v = cleaned;
  else if (cleaned.startsWith('00')) v = `+${cleaned.slice(2)}`;
  else if (cleaned.startsWith('260')) v = `+${cleaned}`;
  else if (cleaned.startsWith('0')) v = `+260${cleaned.slice(1)}`;
  else v = `+260${cleaned}`;
  // Zambia mobile numbers are +260 7XX XXX XXX (12 digits incl + country)
  if (!/^\+260[97]\d{8}$/.test(v)) return null;
  return v;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function logAttempt(phone: string, ip: string | null, ua: string | null,
                          outcome: string, detail?: string) {
  await supabase.from('phone_otp_attempts').insert({
    phone, ip, user_agent: ua, action: 'start', outcome, detail,
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let payload: { phone?: string };
  try { payload = await req.json(); }
  catch { return json(400, { error: 'invalid JSON' }); }

  const phone = toE164Zambia(payload.phone ?? '');
  if (!phone) return json(400, { error: 'enter a valid Zambian mobile number' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent');

  // Rate limit: count starts for this phone in the last hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('phone_otp_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('action', 'start')
    .gte('created_at', since);
  if ((count ?? 0) >= STARTS_PER_HOUR) {
    await logAttempt(phone, ip, ua, 'rate_limited');
    return json(429, { error: 'Too many code requests. Try again later.' });
  }

  if (!TW_SID || !TW_TOKEN || !TW_VERIFY) {
    await logAttempt(phone, ip, ua, 'error', 'twilio not configured');
    return json(503, { error: 'Phone OTP is not configured. Use email instead.' });
  }

  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const url  = `https://verify.twilio.com/v2/Services/${TW_VERIFY}/Verifications`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Channel: 'sms' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await logAttempt(phone, ip, ua, 'error', String(data?.message ?? `twilio ${res.status}`));
    return json(502, { error: 'Could not send the code. Try again in a moment.' });
  }

  await logAttempt(phone, ip, ua, 'sent');
  return json(200, { ok: true });
});
