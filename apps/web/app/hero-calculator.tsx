'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  computeAffordability,
  computeFees,
  computeInterest,
  computeNapsaMonthly,
  computeNhimaMonthly,
  computePayeMonthly,
} from '@eplp/shared';

/**
 * Mobile-first interactive loan calculator embedded at the top fold of the
 * public landing. Touch-friendly sliders, instant feedback, and a single
 * primary CTA. Defaults use the median Richmond rate (4% / month, 30% DSR,
 * 12 months) so the experience is immediate even before the borrower has
 * picked an employer — those values are overridden on /apply/[slug].
 */
export function HeroCalculator(): React.ReactElement {
  const monthlyRate = 0.04;
  const adminFeePct = 0.02;
  const insuranceFeePct = 0.02;
  const maxDebtRatioPct = 0.3;

  const [amount, setAmount] = useState(5000);
  const [tenure, setTenure] = useState(6);
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
  }, [amount, tenure, basicPay]);

  const fmt = (n: number) =>
    `K${n.toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="rounded-2xl border border-ink-muted/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-richmond-primary">
        Quick loan estimate
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Move the sliders — sample employer rates. Exact numbers shown when you start your
        application.
      </p>

      <div className="mt-5 space-y-5">
        <SliderRow
          id="amount"
          label="I need"
          value={fmt(amount)}
          min={500}
          max={50000}
          step={500}
          current={amount}
          onChange={setAmount}
        />
        <SliderRow
          id="tenure"
          label="Over"
          value={`${tenure} month${tenure === 1 ? '' : 's'}`}
          min={1}
          max={12}
          step={1}
          current={tenure}
          onChange={setTenure}
        />
        <SliderRow
          id="pay"
          label="My basic salary"
          value={fmt(basicPay)}
          min={1000}
          max={50000}
          step={500}
          current={basicPay}
          onChange={setBasicPay}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4">
        <Stat label="Monthly" value={fmt(calc.interest.monthlyInstallmentZmw)} highlight />
        <Stat label="Cash you get" value={fmt(calc.fees.disbursedAmountZmw)} highlight />
        <Stat label="Total to repay" value={fmt(calc.interest.totalCollectableZmw)} />
        <Stat
          label="Affordable?"
          value={calc.aff.passes === false ? 'Too high' : 'Yes'}
          tone={calc.aff.passes === false ? 'danger' : 'success'}
        />
      </div>

      <Link
        href="/apply"
        className="mt-6 block w-full rounded-xl bg-richmond-primary py-4 text-center text-base font-semibold text-white shadow-sm transition hover:bg-richmond-primary-dark active:scale-[0.99]"
      >
        Apply now
      </Link>
      <p className="mt-3 text-center text-[11px] text-ink-muted">
        Straight-line interest. No hidden fees. Repaid by payroll deduction.
      </p>
    </div>
  );
}

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (n: number) => void;
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-ink-muted">
          {label}
        </label>
        <span className="text-base font-semibold text-ink-base">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-richmond-primary"
      />
    </div>
  );
}

function Stat({
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
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div
        className={[
          highlight ? 'mt-1 text-xl font-bold' : 'mt-1 text-base font-semibold',
          tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : 'text-ink-base',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}
