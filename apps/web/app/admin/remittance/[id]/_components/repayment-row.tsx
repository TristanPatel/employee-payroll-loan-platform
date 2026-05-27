'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatZmw, ngweeToKwacha, kwachaToNgwee } from '@eplp/shared';
import { recordRepayment } from '../actions';

export function RepaymentRow({
  remittanceBatchId,
  scheduleId,
  loanId,
  loanNo,
  borrowerName,
  nrc,
  dueDate,
  instalmentNo,
  scheduledNgwee,
  alreadyPaidNgwee,
  status,
  paymentDateDefault,
  bankRefDefault,
}: {
  remittanceBatchId: string;
  scheduleId: string;
  loanId: string;
  loanNo: string;
  borrowerName: string;
  nrc: string;
  dueDate: string;
  instalmentNo: number;
  scheduledNgwee: number;
  alreadyPaidNgwee: number;
  status: string;
  paymentDateDefault: string;
  bankRefDefault: string;
}): React.ReactElement {
  const remainingNgwee = Math.max(scheduledNgwee - alreadyPaidNgwee, 0);
  const [amountKwacha, setAmountKwacha] = useState(ngweeToKwacha(remainingNgwee));
  const [paymentDate, setPaymentDate] = useState(paymentDateDefault);
  const [bankRef, setBankRef] = useState(bankRefDefault);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const settled = status === 'deducted' || status === 'remitted';

  function submit() {
    setError(null);
    const ngwee = kwachaToNgwee(amountKwacha);
    if (ngwee <= 0) return setError('Amount must be > 0');
    if (!bankRef.trim()) return setError('Bank ref required');
    start(() => {
      void (async () => {
        const res = await recordRepayment({
          loanId,
          scheduleId,
          amountKwacha,
          paymentDate,
          bankReference: bankRef.trim(),
          remittanceBatchId,
        });
        if (res.error) setError(res.error);
      })();
    });
  }

  return (
    <tr className="border-b border-ink-muted/5 last:border-0 align-middle">
      <td className="px-4 py-1.5 font-medium text-ink-base">{loanNo}</td>
      <td className="px-4 py-1.5 text-ink-muted">{borrowerName}</td>
      <td className="px-4 py-1.5 font-mono text-[11px] text-ink-muted">{nrc}</td>
      <td className="px-4 py-1.5 text-ink-muted">{dueDate}</td>
      <td className="px-4 py-1.5 text-ink-muted">{instalmentNo}</td>
      <td className="px-4 py-1.5 text-right font-medium text-ink-base">
        {formatZmw(scheduledNgwee)}
      </td>
      <td className="px-4 py-1.5 text-right text-ink-muted">
        {alreadyPaidNgwee > 0 ? formatZmw(alreadyPaidNgwee) : '—'}
      </td>
      <td className="px-4 py-1.5">
        <span
          className={
            settled
              ? 'text-xs text-status-success'
              : status === 'partial'
                ? 'text-xs text-status-warning'
                : status === 'missed'
                  ? 'text-xs text-status-danger'
                  : 'text-xs text-ink-muted'
          }
        >
          {status}
        </span>
      </td>
      <td className="px-4 py-1.5">
        {settled ? (
          <span className="text-xs text-ink-muted">paid</span>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={amountKwacha}
              onChange={(e) => setAmountKwacha(Number(e.target.value))}
              className="!h-7 w-24 !px-2 !text-xs"
            />
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="!h-7 w-32 !px-2 !text-xs"
            />
            <Input
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              placeholder="ref"
              className="!h-7 w-24 !px-2 !text-xs"
            />
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? '…' : 'Record'}
            </Button>
          </div>
        )}
        {error ? <p className="mt-1 text-[10px] text-status-danger">{error}</p> : null}
      </td>
    </tr>
  );
}
