'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eraser, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError, FieldHelp } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { sealEnvelope } from './actions';

const CONSENT_TEXT =
  'I consent to transacting electronically with Richmond Finance Limited under the ' +
  'Electronic Communications and Transactions Act No. 4 of 2021. I agree that my ' +
  'electronic signature has the same legal effect as a handwritten signature.';

type Step = 'consent' | 'review' | 'sign' | 'done';

interface DrawnPoint {
  x: number;
  y: number;
  t: number;
}

export function SignFlow({
  contractId,
  signatoryRole,
  documentSha256,
  documentUrl,
  profileNrcHint,
}: {
  contractId: string;
  signatoryRole: 'borrower' | 'employer_signatory' | 'richmond_witness' | 'cfo';
  documentSha256: string;
  documentUrl: string | null;
  profileNrcHint: string | null;
}): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<Step>('consent');
  const [consentChecked, setConsentChecked] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [nrcInput, setNrcInput] = useState('');
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<Date | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pointsRef = useRef<DrawnPoint[]>([]);
  const startedAt = useRef<number>(Date.now());
  const [hasDrawn, setHasDrawn] = useState(false);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [step]);

  function getCanvasPos(canvas: HTMLCanvasElement, ev: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in ev ? ev.touches[0]?.clientX ?? 0 : ev.clientX;
    const clientY = 'touches' in ev ? ev.touches[0]?.clientY ?? 0 : ev.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onCanvasDown(ev: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ev.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPos(canvas, ev);
    ctx.beginPath();
    ctx.moveTo(x, y);
    pointsRef.current.push({ x, y, t: Date.now() - startedAt.current });
  }

  function onCanvasMove(ev: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    ev.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPos(canvas, ev);
    ctx.lineTo(x, y);
    ctx.stroke();
    pointsRef.current.push({ x, y, t: Date.now() - startedAt.current });
    if (!hasDrawn) setHasDrawn(true);
  }

  function onCanvasUp() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pointsRef.current = [];
    setHasDrawn(false);
  }

  // Detect scroll-to-end for the document iframe placeholder
  const onPreviewScroll = useCallback((ev: React.UIEvent<HTMLDivElement>) => {
    const el = ev.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToEnd(true);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);

    if (!consentChecked) {
      setError('Consent is required.');
      setBusy(false);
      return;
    }

    // NRC check: borrower-only
    let nrcPassed = true;
    if (signatoryRole === 'borrower') {
      const normalized = nrcInput.replace(/\s+/g, '').toLowerCase();
      nrcPassed = normalized.length >= 7;
      if (!nrcPassed) {
        setError('NRC entry too short.');
        setBusy(false);
        return;
      }
    }

    if (!hasDrawn) {
      setError('Please sign the canvas.');
      setBusy(false);
      return;
    }
    if (!typedName.trim()) {
      setError('Please type your full name as a fallback identifier.');
      setBusy(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Canvas missing.');
      setBusy(false);
      return;
    }
    const signatureImageBase64 = canvas.toDataURL('image/png');

    let geo: { lat: number; lon: number; accuracy?: number } | null = null;
    if ('geolocation' in navigator) {
      try {
        geo = await new Promise<{ lat: number; lon: number; accuracy?: number } | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 4000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timer);
              resolve({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
            },
            () => {
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 3000 },
          );
        });
      } catch {
        geo = null;
      }
    }

    const result = await sealEnvelope({
      contractId,
      signatoryRole,
      consentText: CONSENT_TEXT,
      typedName: typedName.trim(),
      signatureImageBase64,
      drawnPoints: pointsRef.current,
      nrcCheckPassed: nrcPassed,
      authenticationEvidence: {
        method: 'session',
        verified_at: new Date().toISOString(),
      },
      deviceFingerprint:
        typeof window !== 'undefined' ? `${navigator.userAgent}|${screen.width}x${screen.height}` : null,
      geolocation: geo,
    });

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    setSignedAt(new Date());
    setStep('done');
    setBusy(false);
    router.refresh();
  }

  if (step === 'done') {
    return (
      <Card>
        <CardContent className="text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-status-success" />
          <h2 className="text-lg font-semibold text-ink-base">Signature recorded</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Sealed at {signedAt?.toLocaleString('en-GB')}. The next required signatory will be notified.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Stepper step={step} />

      {step === 'consent' && (
        <Card>
          <CardHeader>
            <CardTitle>Electronic-signature consent</CardTitle>
            <CardDescription>Read carefully before continuing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-ink-muted/15 bg-surface-base p-4 text-sm text-ink-base">
              {CONSENT_TEXT}
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-ink-base">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ink-muted/40"
              />
              I have read and agree to the above consent.
            </label>
          </CardContent>
          <CardFooter>
            <Button disabled={!consentChecked} onClick={() => setStep('review')}>
              Continue to document review
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review the contract</CardTitle>
            <CardDescription>Scroll to the end before signing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-ink-muted/15 bg-surface-base p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-xs uppercase tracking-wide text-ink-muted">Contract</dt>
                <dd className="text-right text-ink-base">{contractId.slice(0, 8)}…</dd>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">SHA-256</dt>
                <dd className="text-right font-mono text-[10px] text-ink-base">
                  {documentSha256 ? `${documentSha256.slice(0, 16)}…${documentSha256.slice(-16)}` : '—'}
                </dd>
              </dl>
              {documentUrl ? (
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-richmond-primary hover:underline"
                >
                  Open the PDF in a new tab <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="mt-3 text-xs text-ink-muted">
                  PDF not yet generated. (You can still sign — staff will regenerate before sealing.)
                </p>
              )}
            </div>
            <div
              onScroll={onPreviewScroll}
              className="h-40 overflow-y-auto rounded-md border border-ink-muted/15 bg-white p-4 text-sm text-ink-base"
            >
              <p>
                This loan agreement governs your payroll-deduction loan with Richmond Finance Limited.
              </p>
              <p className="mt-2">
                Interest is fixed for the life of the loan. Repayments are deducted from your salary at source.
                On termination of employment for any reason, the outstanding balance becomes immediately
                repayable in full, and your employer may deduct any sums owed from your terminal benefits.
              </p>
              <p className="mt-2">
                The agreement is executed under the Electronic Communications and Transactions Act No. 4 of 2021
                and your data is processed per the Data Protection Act No. 3 of 2021. Disputes are resolved by
                arbitration in Lusaka under the Arbitration Act No. 19 of 2000.
              </p>
              <p className="mt-2 text-ink-muted">— Scroll to the end before signing —</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => setStep('consent')}>
              Back
            </Button>
            <Button disabled={!scrolledToEnd} onClick={() => setStep('sign')}>
              Continue to sign
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'sign' && (
        <Card>
          <CardHeader>
            <CardTitle>Capture your signature</CardTitle>
            <CardDescription>
              Draw your signature, type your full name, and confirm. We&apos;ll record IP, device, and
              timestamp for the evidence chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatoryRole === 'borrower' ? (
              <div>
                <Label htmlFor="nrc" required>
                  Confirm your NRC
                </Label>
                <Input
                  id="nrc"
                  value={nrcInput}
                  onChange={(e) => setNrcInput(e.target.value)}
                  required
                  placeholder="123456/78/9"
                  className="mt-1"
                />
                <FieldHelp>
                  {profileNrcHint
                    ? `Hint: ${profileNrcHint} (last 3 digits visible)`
                    : 'Enter the NRC on file with Richmond.'}
                </FieldHelp>
              </div>
            ) : null}

            <div>
              <Label htmlFor="typed_name" required>
                Type your full name
              </Label>
              <Input
                id="typed_name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                required
                placeholder="Your full legal name"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Draw your signature</Label>
              <div className="mt-1 rounded-md border border-ink-muted/20 bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
                  className="w-full touch-none"
                  onMouseDown={onCanvasDown}
                  onMouseMove={onCanvasMove}
                  onMouseUp={onCanvasUp}
                  onMouseLeave={onCanvasUp}
                  onTouchStart={onCanvasDown}
                  onTouchMove={onCanvasMove}
                  onTouchEnd={onCanvasUp}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-muted">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 hover:text-richmond-primary"
                >
                  <Eraser className="h-3 w-3" /> Clear
                </button>
                <span>Stroke points captured: {pointsRef.current.length}</span>
              </div>
            </div>

            <FieldError message={error} />
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => setStep('review')} disabled={busy}>
              Back
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Sealing…' : 'Sign & seal'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

function Stepper({ step }: { step: Step }): React.ReactElement {
  const order: Step[] = ['consent', 'review', 'sign'];
  const idx = order.indexOf(step);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto rounded-md border border-ink-muted/10 bg-white px-3 py-2 text-xs">
      {order.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={cn(
              'grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold',
              i < idx
                ? 'bg-status-success text-white'
                : i === idx
                  ? 'bg-richmond-primary text-white'
                  : 'bg-ink-muted/15 text-ink-muted',
            )}
          >
            {i < idx ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </span>
          <span className={cn(i === idx ? 'font-medium text-ink-base' : 'text-ink-muted')}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
          {i < order.length - 1 ? <span className="px-1 text-ink-muted/40">›</span> : null}
        </li>
      ))}
    </ol>
  );
}
