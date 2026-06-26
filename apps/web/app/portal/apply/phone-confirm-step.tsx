'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Apply-wizard step between Documents and Amount. Borrower is already
 * signed in; this step proves the SMS-receiving number on file is live
 * by sending a Twilio Verify code and asking for it back. On success the
 * server stamps loan_applications.phone_confirmed_at and the borrower
 * advances. submitApplication() refuses to submit until that stamp is
 * non-null, so the UI gate can't be bypassed.
 */
export function PhoneConfirmStep({
  applicationId,
  borrowerPhone,
  onDone,
  onBack,
}: {
  applicationId: string;
  borrowerPhone: string | null;
  onDone: () => void;
  onBack: () => void;
}): React.ReactElement {
  const [phone, setPhone] = useState(borrowerPhone ?? '');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'request' | 'verify' | 'done'>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/phone-otp/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? 'Could not send the code.');
      setBusy(false);
      return;
    }
    setStage('verify');
    setBusy(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/phone-otp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: code.trim(), application_id: applicationId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? 'Could not verify the code.');
      setBusy(false);
      return;
    }
    setStage('done');
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your mobile</CardTitle>
        <CardDescription>
          Richmond will text status updates about your application to this number. We&apos;ll
          send you a one-time code to make sure it&apos;s correct.
        </CardDescription>
      </CardHeader>

      {stage === 'request' && (
        <form onSubmit={sendCode}>
          <CardContent>
            <div>
              <Label htmlFor="confirm_phone" required>Mobile</Label>
              <Input
                id="confirm_phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0977 123 456"
                className="mt-1"
              />
              <FieldHelp>Zambia mobile (097 / 096…). We&apos;ll text you a one-time code.</FieldHelp>
            </div>
            <FieldError message={error} />
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>Back</Button>
            <Button type="submit" disabled={busy || phone.trim().length < 9}>
              {busy ? 'Sending code…' : 'Send code'}
            </Button>
          </CardFooter>
        </form>
      )}

      {stage === 'verify' && (
        <form onSubmit={verifyCode}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="confirm_otp" required>One-time code</Label>
              <Input
                id="confirm_otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4,10}"
                maxLength={10}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="mt-1 tracking-[0.4em] text-center text-lg"
              />
              <FieldHelp>Enter the code we texted to {phone}.</FieldHelp>
            </div>
            <FieldError message={error} />
            <button
              type="button"
              className="block w-full text-center text-xs text-ink-muted hover:text-richmond-primary"
              onClick={() => { setStage('request'); setCode(''); setError(null); }}
            >
              Use a different number
            </button>
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>Back</Button>
            <Button type="submit" disabled={busy || code.length < 4}>
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
          </CardFooter>
        </form>
      )}

      {stage === 'done' && (
        <>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md border border-status-success/40 bg-status-success/5 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-status-success" />
              <div>
                <div className="font-medium text-ink-base">{phone} confirmed</div>
                <div className="text-xs text-ink-muted">We&apos;ll text status updates to this number.</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
            <Button type="button" onClick={onDone}>Continue</Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
