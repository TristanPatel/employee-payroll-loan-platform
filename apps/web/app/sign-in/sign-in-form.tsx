'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Mode = 'password' | 'otp-request' | 'otp-verify';

export function SignInForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    router.push(next ?? '/launch');
    router.refresh();
  }

  async function onOtpRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (otpError) {
      setError(otpError.message);
      setBusy(false);
      return;
    }
    setMode('otp-verify');
    setBusy(false);
  }

  async function onOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (verifyError) {
      setError(verifyError.message);
      setBusy(false);
      return;
    }
    router.push(next ?? '/launch');
    router.refresh();
  }

  if (mode === 'otp-verify') {
    return (
      <Card>
        <form onSubmit={onOtpVerify} noValidate>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="otp" required>
                6-digit code
              </Label>
              <Input
                id="otp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-1 text-center text-lg tracking-[0.5em]"
              />
              <FieldHelp>Sent to {email}</FieldHelp>
            </div>
            <FieldError message={error} />
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" disabled={busy || otp.length !== 6} className="w-full">
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </Button>
            <button
              type="button"
              className="text-xs text-ink-muted hover:text-richmond-primary"
              onClick={() => {
                setMode('otp-request');
                setOtp('');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={mode === 'password' ? onPasswordSubmit : onOtpRequest} noValidate>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          {mode === 'password' ? (
            <div>
              <Label htmlFor="password" required>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : (
            <FieldHelp>
              We&apos;ll email a 6-digit code. Works for new accounts too — no password needed.
            </FieldHelp>
          )}
          <FieldError message={error} />
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" disabled={busy} className="w-full">
            {busy
              ? mode === 'password'
                ? 'Signing in…'
                : 'Sending code…'
              : mode === 'password'
                ? 'Sign in'
                : 'Email me a code'}
          </Button>
          <button
            type="button"
            className="text-xs text-ink-muted hover:text-richmond-primary"
            onClick={() => {
              setMode(mode === 'password' ? 'otp-request' : 'password');
              setError(null);
            }}
          >
            {mode === 'password' ? 'Email me a code instead' : 'Use a password instead'}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
