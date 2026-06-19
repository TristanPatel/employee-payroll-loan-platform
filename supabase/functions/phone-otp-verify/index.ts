// supabase/functions/phone-otp-verify/index.ts
//
// Borrower signup step 2: verify the SMS code with Twilio Verify, then
// create/link a Supabase auth user and return a magic-link the client
// browser can hit to land a real session cookie. The borrower never sees
// the synthesized email — it's an internal identifier only.

import { createClient } from 'jsr:@supabase/supabase-js@^2.46.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TW_SID       = Deno.env.get('TWILIO_ACCOUNT_SID');
const TW_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN');
const TW_VERIFY    = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

// Internal-only email synthesized from the verified phone. Borrowers don't
// see this; it lives on the auth.users row so Supabase can manage sessions
// through the standard email-based machinery.
const SYNTH_EMAIL_DOMAIN = Deno.env.get('PHONE_OTP_EMAIL_DOMAIN') ?? 'phone-otp.richmond-finance.local';

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

function synthEmail(phone: string): string {
  // phone is +2609XXXXXXXX. Strip the leading '+' for a stable local part.
  return `${phone.slice(1)}@${SYNTH_EMAIL_DOMAIN}`;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

  let payload: { phone?: string; code?: string; full_name?: string; employer_id?: string };
  try { payload = await req.json(); }
  catch { return json(400, { error: 'invalid JSON' }); }

  const phone = toE164Zambia(payload.phone ?? '');
  const code  = (payload.code ?? '').replace(/\D/g, '');
  if (!phone)        return json(400, { error: 'enter a valid Zambian mobile number' });
  if (code.length < 4) return json(400, { error: 'enter the code from the SMS' });

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
    return json(503, { error: 'Phone OTP is not configured.' });
  }

  // 1. Confirm the code with Twilio Verify.
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const url  = `https://verify.twilio.com/v2/Services/${TW_VERIFY}/VerificationCheck`;
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

  // 2. Find or create the auth user. We key on a synthesized email so
  //    Supabase's email-based session machinery still works; the borrower
  //    never sees this address.
  const email = synthEmail(phone);
  const fullName  = (payload.full_name ?? '').trim() || null;
  const employerId = payload.employer_id || null;

  // Probe existing user.
  // @ts-ignore — admin.listUsers accepts a single-page filter on email.
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1, email });
  let userId: string | null = existing?.users?.[0]?.id ?? null;

  if (!userId) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      phone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'employee',
        employer_id: employerId,
        signup_via: 'phone_otp',
      },
    });
    if (createErr || !created.user) {
      await logAttempt(phone, ip, ua, 'error', `createUser: ${createErr?.message ?? 'unknown'}`);
      return json(500, { error: 'Could not finish signing you up. Try again.' });
    }
    userId = created.user.id;
  } else {
    // Existing user — keep the phone current.
    await supabase.auth.admin.updateUserById(userId, { phone, phone_confirm: true });
  }

  // 3. Generate a magic link the client browser follows to redeem a real
  //    Supabase session. We send only the redirect target back; the link
  //    itself is signed and one-time-use.
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link?.properties?.action_link) {
    await logAttempt(phone, ip, ua, 'error', `generateLink: ${linkErr?.message ?? 'no link'}`);
    return json(500, { error: 'Could not finish signing you in. Try again.' });
  }

  return json(200, { ok: true, action_link: link.properties.action_link });
});
