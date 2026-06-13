'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Set-a-new-password form. The user lands here from a recovery email after
 * Supabase has already established a (short-lived) recovery session, so we
 * can call updateUser({ password }) directly.
 */
export function RecoveryForm(): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: e1 } = await supabase.auth.updateUser({ password });
    if (e1) {
      setError(
        /not authenticated|jwt/i.test(e1.message)
          ? 'This recovery link has expired or is invalid. Request a new one from the sign-in page.'
          : e1.message,
      );
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    // Force a clean reload so the new session cookie is sent on the next nav.
    setTimeout(() => {
      window.location.assign('/launch');
    }, 1200);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-ink-base">
          Password updated. Taking you in…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pw" required>New password</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
            <FieldHelp>At least 12 characters. Mix letters, digits and symbols.</FieldHelp>
          </div>
          <div>
            <Label htmlFor="pw2" required>Confirm new password</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1"
            />
          </div>
          <FieldError message={error} />
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
