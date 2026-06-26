// supabase/functions/phone-otp-confirm-application/index.ts
//
// Apply-wizard phone-confirmation step. The borrower is ALREADY signed in;
// this function just verifies the OTP they typed and stamps
// loan_applications.phone_confirmed_at on their application. We do NOT
// touch auth.users (that's what phone-otp-verify does for signup) — this
// is a per-application proof that the phone we'll SMS for status updates
// is live and controlled by the borrower right now.
//
// Reuses the Twilio Verify Service SID + creds and the
// phone_otp_attempts audit/rate-limit table from migration 42.

import { createClient } from 'jsr:@supabase/supabase-js@^2.46.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TW_SID       = Deno.env.get('TWILIO_ACCOUNT_SID');
const TW_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN');
const TW_VERIFY    = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

const VERIFIES_PER_HOUR = 10;

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
  if (!/^\+260[97]\d{8}$/.test(v)) return null;
  return v;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function logAttempt(phone: string, ip: string | null, ua: string | null,
                          outcome: string, detail?: string) {
  await supabase.from('phone_otp_attempts').insert({
    phone, ip, user_agent: ua, action: 'verify', outcome, detail,
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let payload: { phone?: string; code?: string; application_id?: string };
  try { payload = await req.json(); }
  catch { return json(400, { error: 'invalid JSON' }); }

  const phone = toE164Zambia(payload.phone ?? '');
  const code  = (payload.code ?? '').replace(/\D/g, '');
  const applicationId = (payload.application_id ?? '').trim();
  if (!phone) return json(400, { error: 'enter a valid Zambian mobile number' });
  if (code.length < 4) return json(400, { error: 'enter the code from the SMS' });
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
    return json(400, { error: 'application_id is required' });
  }

  // The borrower's anon-key JWT is in the Authorization header; pull their
  // user id from it so we can confirm the application is theirs without
  // trusting any client claim.
  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json(401, { error: 'sign-in required' });
  const { data: userRes } = await supabase.auth.getUser(accessToken);
  const userId = userRes?.user?.id;
  if (!userId) return json(401, { error: 'sign-in required' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent');

  // Rate limit verifies per phone per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('phone_otp_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('action', 'verify')
    .gte('created_at', since);
  if ((count ?? 0) >= VERIFIES_PER_HOUR) {
    await logAttempt(phone, ip, ua, 'rate_limited');
    return json(429, { error: 'Too many attempts. Request a new code in an hour.' });
  }

  if (!TW_SID || !TW_TOKEN || !TW_VERIFY) {
    await logAttempt(phone, ip, ua, 'error', 'twilio not configured');
    return json(503, { error: 'Phone confirmation is not configured.' });
  }

  // Confirm the application belongs to the signed-in borrower BEFORE we
  // burn a Twilio call. Saves cost on bad input.
  const { data: app } = await supabase
    .from('loan_applications')
    .select('id, employee_id, employees!inner(profile_id)')
    .eq('id', applicationId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const borrowerProfileId = (app?.employees as any)?.profile_id;
  if (!app || borrowerProfileId !== userId) {
    return json(403, { error: 'application not found or not yours' });
  }

  // Verify the code with Twilio Verify.
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const url = `https://verify.twilio.com/v2/Services/${TW_VERIFY}/VerificationCheck`;
  const checkRes = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  const check = await checkRes.json().catch(() => ({}));
  if (!checkRes.ok) {
    await logAttempt(phone, ip, ua, 'error', String(check?.message ?? `twilio ${checkRes.status}`));
    return json(502, { error: 'Could not verify the code. Try again.' });
  }
  if (check.status !== 'approved') {
    await logAttempt(phone, ip, ua, 'denied', String(check.status ?? 'denied'));
    return json(400, { error: 'That code didn’t match. Check the SMS and try again.' });
  }

  await logAttempt(phone, ip, ua, 'verified');

  // Stamp the application so submitApplication() can read it server-side.
  const { error: updateErr } = await supabase
    .from('loan_applications')
    .update({ phone_confirmed_at: new Date().toISOString() })
    .eq('id', applicationId);
  if (updateErr) {
    await logAttempt(phone, ip, ua, 'error', `update: ${updateErr.message}`);
    return json(500, { error: 'Could not record the confirmation. Try again.' });
  }

  return json(200, { ok: true });
});
