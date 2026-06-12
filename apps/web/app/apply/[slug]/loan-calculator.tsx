'use client';

import { useMemo, useState } from 'react';
import {
  computeAffordability,
  computeFees,
  computeInterest,
  computeNapsaMonthly,
  computeNhimaMonthly,
  computePayeMonthly,
} from '@eplp/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

/**
 * Live affordability calculator on the public apply landing. Borrowers see
 * the straight-line instalment, total cost, cash-in-hand, and whether the
 * debt-ratio cap passes — before they create an account. All maths comes
 * from @eplp/shared, the same functions the wizard and the database use.
 */
export function LoanCalculator({
  monthlyRate,
  adminFeePct,
  insuranceFeePct,
  maxDebtRatioPct,
  maxTenureMonths,
}: {
  monthlyRate: number;
  adminFeePct: number;
  insuranceFeePct: number;
  maxDebtRatioPct: number;
  maxTenureMonths: number;
}): React.ReactElement {
  const [amount, setAmount] = useState(5000);
  const [tenure, setTenure] = useState(Math.min(6, maxTenureMonths));
  const [basicPay, setBasicPay] = useState(8000);

  const calc = useMemo(() => {
    const napsa = computeNapsaMonthly(basicPay);
    const nhima = computeNhimaMonthly(basicPay);
    const paye = computePayeMonthly(basicPay - napsa);
    const interest = computeInterest({
      principalZmw: amount,
      monthlyRate,
      tenureMonths: tenure,
    });
    const fees = computeFees({
      principalZmw: amount,
      adminFeePct,
      insuranceFeePct,
    });
    const aff = computeAffordability(
      {
        grossPayZmw: basicPay,
        basicPayZmw: basicPay,
        payeZmw: paye,
        napsaZmw: napsa,
        nhimaZmw: nhima,
        otherStatutoryZmw: 0,
        existingObligationsZmw: 0,
        monthlyInterestRate: monthlyRate,
        tenureMonths: tenure,
        proposedPrincipalZmw: amount,
      },
      maxDebtRatioPct,
    );
    return { interest, fees, aff };
  }, [amount, tenure, basicPay, monthlyRate, adminFeePct, insuranceFeePct, maxDebtRatioPct]);

  const fmt = (n: number) =>
    `K ${n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What would my loan cost?</CardTitle>
        <CardDescription>
          Straight-line interest — the rate applies to the original amount each month, so your
          instalment never changes. Move the sliders; everything updates live.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-5">
          <div>
            <Label htmlFor="calc-amount">
              I want to borrow: <span className="font-semibold text-ink-base">{fmt(amount)}</span>
            </Label>
            <input
              id="calc-amount"
              type="range"
              min={500}
              max={50000}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-2 w-full accent-richmond-primary"
            />
          </div>
          <div>
            <Label htmlFor="calc-tenure">
              Over: <span className="font-semibold text-ink-base">{tenure} months</span>
            </Label>
            <input
              id="calc-tenure"
              type="range"
              min={1}
              max={maxTenureMonths}
              step={1}
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value))}
              className="mt-2 w-full accent-richmond-primary"
            />
          </div>
          <div>
            <Label htmlFor="calc-pay">
              My basic monthly salary:{' '}
              <span className="font-semibold text-ink-base">{fmt(basicPay)}</span>
            </Label>
            <input
              id="calc-pay"
              type="range"
              min={1000}
              max={60000}
              step={500}
              value={basicPay}
              onChange={(e) => setBasicPay(Number(e.target.value))}
              className="mt-2 w-full accent-richmond-primary"
            />
          </div>
        </div>

        <div className="rounded-lg bg-surface-muted p-4">
          <dl className="space-y-2 text-sm">
            <CalcRow label="Monthly instalment" value={fmt(calc.interest.monthlyInstallmentZmw)} highlight />
            <CalcRow label="Cash you receive" value={fmt(calc.fees.disbursedAmountZmw)} highlight />
            <CalcRow label="Total interest" value={fmt(calc.interest.totalInterestZmw)} />
            <CalcRow label="Total you repay" value={fmt(calc.interest.totalCollectableZmw)} />
            <CalcRow
              label="Debt ratio"
              value={
                calc.aff.debtRatioPct === null ? '—' : `${(calc.aff.debtRatioPct * 100).toFixed(1)}%`
              }
              tone={calc.aff.passes === false ? 'danger' : 'success'}
            />
          </dl>
          {calc.aff.passes === false ? (
            <p className="mt-3 text-xs text-status-danger">
              Above your employer&apos;s {Math.round(maxDebtRatioPct * 100)}% cap — try a smaller
              amount or longer tenure.
            </p>
          ) : (
            <p className="mt-3 text-xs text-status-success">
              Within your employer&apos;s affordability cap.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CalcRow({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: 'success' | 'danger';
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd
        className={[
          highlight ? 'text-base font-semibold' : 'text-sm',
          tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : 'text-ink-base',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}
