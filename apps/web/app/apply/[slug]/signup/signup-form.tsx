'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Channel = 'phone' | 'email';
type Step = 'request' | 'verify';

export function SignupForm({
  employerId,
}: {
  employerId: string;
}): React.ReactElement {
  // Phone is the default in Zambia — most borrowers have a mobile, fewer
  // have a reliable email. Email stays available as a fallback.
  const [channel, setChannel] = useState<Channel>('phone');
  const [step, setStep] = useState<Step>('request');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(newChannel?: Channel) {
    setStep('request');
    setOtp('');
    setError(null);
    if (newChannel) setChannel(newChannel);
  }

  async function requestEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { role: 'employee', full_name: fullName, employer_id: employerId },
      },
    });
    if (otpErr) { setError(otpErr.message); setBusy(false); return; }
    setStep('verify');
    setBusy(false);
  }

  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email, token: otp.trim(), type: 'signup',
    });
    if (verifyErr) {
      setError(/expired or is invalid/i.test(verifyErr.message)
        ? 'That code didn’t match. Open the most recent email and enter the full code exactly.'
        : verifyErr.message);
      setBusy(false);
      return;
    }
    // Hard nav so the just-set chunked auth cookie is sent to /portal on
    // the first request (a soft router.push would race the cookie write).
    window.location.assign(`/portal/apply?employer=${employerId}`);
  }

  async function requestPhone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/phone-otp/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setError(body.error ?? 'Could not send the code.'); setBusy(false); return; }
    setStep('verify');
    setBusy(false);
  }

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/phone-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otp.trim(), full_name: fullName, employer_id: employerId }),
    });
    const body = (await res.json().catch(() => ({}))) as { action_link?: string; error?: string };
    if (!res.ok || !body.action_link) {
      setError(body.error ?? 'Could not verify the code.');
      setBusy(false);
      return;
    }
    // Magic link issued by the edge function — landing on it sets the
    // Supabase session cookie and redirects us into the borrower portal.
    window.location.assign(body.action_link);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Sign-up method"
           className="grid grid-cols-2 rounded-md border border-ink-muted/15 p-1 text-sm">
        <button
          type="button" role="tab" aria-selected={channel === 'phone'}
          className={`rounded-sm px-3 py-1.5 transition ${channel === 'phone' ? 'bg-richmond-primary text-white' : 'text-ink-base hover:bg-surface-muted'}`}
          onClick={() => reset('phone')}>
          Phone (recommended)
        </button>
        <button
          type="button" role="tab" aria-selected={channel === 'email'}
          className={`rounded-sm px-3 py-1.5 transition ${channel === 'email' ? 'bg-richmond-primary text-white' : 'text-ink-base hover:bg-surface-muted'}`}
          onClick={() => reset('email')}>
          Email
        </button>
      </div>

      {channel === 'phone' && step === 'request' && (
        <form onSubmit={requestPhone} className="space-y-4">
          <div>
            <Label htmlFor="full_name" required>Full name</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone" required>Mobile</Label>
            <Input id="phone" type="tel" autoComplete="tel" required value={phone}
                   onChange={(e) => setPhone(e.target.value)} placeholder="0977 123 456"
                   className="mt-1" />
            <FieldHelp>We&apos;ll text you a one-time code. Zambia mobile (097 / 096…).</FieldHelp>
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending code…' : 'Send code'}
          </Button>
          <p className="text-center text-xs text-ink-muted">
            Already have an account?{' '}
            <a className="text-richmond-primary hover:underline"
               href={`/sign-in?next=${encodeURIComponent(`/portal/apply?employer=${employerId}`)}`}>
              Sign in
            </a>
          </p>
        </form>
      )}

      {channel === 'email' && step === 'request' && (
        <form onSubmit={requestEmail} className="space-y-4">
          <div>
            <Label htmlFor="full_name_email" required>Full name</Label>
            <Input id="full_name_email" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email}
                   onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            <FieldHelp>We&apos;ll email you a one-time code.</FieldHelp>
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending code…' : 'Send code'}
          </Button>
          <p className="text-center text-xs text-ink-muted">
            Already have an account?{' '}
            <a className="text-richmond-primary hover:underline"
               href={`/sign-in?next=${encodeURIComponent(`/portal/apply?employer=${employerId}`)}`}>
              Sign in
            </a>
          </p>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={channel === 'phone' ? verifyPhone : verifyEmail} className="space-y-4">
          <div>
            <Label htmlFor="otp" required>One-time code</Label>
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code"
                   pattern="[0-9]{4,10}" maxLength={10} required autoFocus value={otp}
                   onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                   className="mt-1 tracking-[0.4em] text-center text-lg" />
            <FieldHelp>
              Enter the code we {channel === 'phone' ? 'texted to' : 'emailed to'}{' '}
              {channel === 'phone' ? phone : email}.
            </FieldHelp>
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy || otp.length < 4} className="w-full">
            {busy ? 'Verifying…' : 'Verify & continue'}
          </Button>
          <button
            type="button"
            className="block w-full text-center text-xs text-ink-muted hover:text-richmond-primary"
            onClick={() => reset()}>
            Use a different {channel === 'phone' ? 'number' : 'email'}
          </button>
        </form>
      )}
    </div>
  );
}
