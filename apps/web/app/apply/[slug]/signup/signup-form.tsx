'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
    const supabase = getSupabaseBrowser();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (verifyErr) {
      setError(verifyErr.message);
      setBusy(false);
      return;
    }
    router.push(`/portal/apply?employer=${employerId}`);
    router.refresh();
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
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="mt-1 tracking-[0.5em] text-center text-lg"
        />
        <FieldHelp>Sent to {email}</FieldHelp>
      </div>
      <FieldError message={error} />
      <Button type="submit" disabled={busy || otp.length !== 6} className="w-full">
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
