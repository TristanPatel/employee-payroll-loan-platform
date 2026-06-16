'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Mode = 'password' | 'otp-request' | 'otp-verify';

const RESEND_COOLDOWN_S = 60;

/**
 * GoTrue invalidates every previously-issued OTP the moment a new one is
 * requested. Users who tap "Email me a code" twice (or read the code from
 * an older email in the same thread) get "token has expired or is invalid"
 * even though they typed exactly what the email said. The form therefore
 * enforces a 60s resend cooldown and translates that error into a clear
 * use-the-newest-email instruction.
 */
export function SignInForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}): React.ReactElement {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Full-document navigation (not router.push). /launch is a Route Handler
  // that issues a role-based 307; a soft RSC navigation to it is unreliable,
  // and a hard navigation guarantees the just-set auth cookie is sent so the
  // server resolves the session on the first hop.
  //
  // We always route through /launch and let it decide where to go, forwarding
  // `next` for it to validate. Blindly following `next` here was the source
  // of two reported loops: a borrower whose `next` pointed at /apply/<slug>
  // (the public marketing page) and an employer whose `next` pointed at
  // /admin (which the admin layout rejects, bouncing back to /sign-in).
  // /launch honours `next` only when the user's role can actually visit it.
  function goAfterAuth() {
    const url = next ? `/launch?next=${encodeURIComponent(next)}` : '/launch';
    window.location.assign(url);
  }

  function friendlyOtpError(message: string): string {
    if (/expired or is invalid/i.test(message)) {
      return 'That code didn’t match. Open the most recent email from Richmond Finance and enter the full code exactly.';
    }
    if (/rate limit|only request this after/i.test(message)) {
      return 'Too many requests — wait a few seconds and try again.';
    }
    if (/signups? not allowed|user not found|otp_disabled/i.test(message)) {
      return 'No Richmond account found for that email. Borrowers apply through their employer’s link; staff are set up by an administrator.';
    }
    return message;
  }

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
    goAfterAuth();
  }

  async function onOtpRequest(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      setError(friendlyOtpError(otpError.message));
      setBusy(false);
      return;
    }
    setMode('otp-verify');
    setOtp('');
    setCooldown(RESEND_COOLDOWN_S);
    setBusy(false);
  }

  async function resendOtp() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      setError(friendlyOtpError(otpError.message));
      setBusy(false);
      return;
    }
    setOtp('');
    setCooldown(RESEND_COOLDOWN_S);
    setBusy(false);
  }

  async function onOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'email',
    });
    if (verifyError) {
      setError(friendlyOtpError(verifyError.message));
      setBusy(false);
      return;
    }
    goAfterAuth();
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
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                maxLength={10}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-1 text-center text-lg tracking-[0.4em]"
              />
              <FieldHelp>
                Sent to {email}. Enter the full code from the email exactly. Use the newest
                email — requesting again cancels older codes.
              </FieldHelp>
            </div>
            <FieldError message={error} />
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" disabled={busy || otp.length < 6} className="w-full">
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </Button>
            <button
              type="button"
              className="text-xs text-ink-muted enabled:hover:text-richmond-primary disabled:opacity-60"
              disabled={cooldown > 0 || busy}
              onClick={() => void resendOtp()}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
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
          <Button type="submit" disabled={busy || (mode === 'otp-request' && cooldown > 0)} className="w-full">
            {busy
              ? mode === 'password'
                ? 'Signing in…'
                : 'Sending code…'
              : mode === 'password'
                ? 'Sign in'
                : cooldown > 0
                  ? `Wait ${cooldown}s`
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
