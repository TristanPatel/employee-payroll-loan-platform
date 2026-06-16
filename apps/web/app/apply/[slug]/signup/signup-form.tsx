'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Step = 'request' | 'verify';

export function SignupForm({
  employerId,
  employerSlug,
}: {
  employerId: string;
  employerSlug: string;
}): React.ReactElement {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          role: 'employee',
          full_name: fullName,
          employer_id: employerId,
        },
      },
    });
    if (otpErr) {
      setError(otpErr.message);
      setBusy(false);
      return;
    }
    setStep('verify');
    setBusy(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // This form always creates the borrower (shouldCreateUser: true), so the
    // token GoTrue issues is a signup confirmation — verify it with the
    // matching type. One call, no fallback.
    const supabase = getSupabaseBrowser();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'signup',
    });
    if (verifyErr) {
      setError(
        /expired or is invalid/i.test(verifyErr.message)
          ? 'That code didn’t match. Open the most recent email and enter the full code exactly.'
          : verifyErr.message,
      );
      setBusy(false);
      return;
    }
    // Hard navigation so the just-set (chunked) auth cookie is sent on the
    // first request to the protected /portal route — a soft router.push can
    // race the cookie write and bounce a brand-new borrower back out.
    window.location.assign(`/portal/apply?employer=${employerId}`);
  }

  if (step === 'request') {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        <div>
          <Label htmlFor="full_name" required>Full name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
          <FieldHelp>We&apos;ll email you a 6-digit code.</FieldHelp>
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Sending code…' : 'Send code'}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Already have an account?{' '}
          <a className="text-richmond-primary hover:underline" href={`/sign-in?next=/apply/${employerSlug}`}>
            Sign in
          </a>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-4">
      <div>
        <Label htmlFor="otp" required>6-digit code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          required
          autoFocus
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="mt-1 tracking-[0.4em] text-center text-lg"
        />
        <FieldHelp>Enter the full code sent to {email}.</FieldHelp>
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={busy || otp.length < 6} className="w-full">
        {busy ? 'Verifying…' : 'Verify & continue'}
      </Button>
      <button
        type="button"
        className="block w-full text-center text-xs text-ink-muted hover:text-richmond-primary"
        onClick={() => {
          setStep('request');
          setOtp('');
          setError(null);
        }}
      >
        Use a different email
      </button>
    </form>
  );
}
