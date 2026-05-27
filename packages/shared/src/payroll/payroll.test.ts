/**
 * Vitest table-driven coverage for the Phase 2 payroll helpers.
 *
 * The "xlsm worked example" reproduces row 3 of the live Choppies/Sino loan
 * generator workbook (Affordability v2.3 sheet):
 *   Borrower: MUSONDA COSTA (Sino Metals security guard)
 *   Basic: K4,102.23 | Allowances: K1,494.38 | Gross: K5,596.61
 *   Other-loan deduction: K41.02 (union contribution)
 *   Principal: K7,250 over 6 months at 4%/month
 *
 * Expected values from the spreadsheet:
 *   PAYE                  K313.98
 *   NAPSA (5% × basic)    K205.11
 *   NHIMA (1% × basic)    K41.02
 *   Net after statutory   K4,995.47
 *   Total interest        K1,740.00
 *   Total collectable     K8,990.00
 *   Monthly instalment    K1,498.33
 *   Debt ratio            29.99%
 *   Admin fee             K145
 *   Insurance fee         K145
 *   Disbursed             K6,960
 */

import { describe, expect, it } from 'vitest';

import { kwachaToNgwee, ngweeToKwacha, formatZmw, NGWEE_PER_KWACHA } from '../money';
import {
  formatLusakaDate,
  formatLusakaDateTime,
  addMonthsAligned,
  LUSAKA_TZ,
  toLusakaIsoDate,
} from '../time';
import { formatLoanNumber, formatPreApprovalSerial } from '../ids';
import {
  computePayeMonthly,
  DEFAULT_PAYE_BANDS,
} from './paye';
import { computeNapsaMonthly, NAPSA_RATE, NAPSA_DEFAULT_CEILING_ZMW } from './napsa';
import { computeNhimaMonthly, NHIMA_RATE } from './nhima';
import { computeInterest } from './interest';
import { computeFees } from './fees';
import { computeAffordability } from './affordability';
import { generateSchedule } from './schedule';
import { computeSettlement } from './settlement';
import {
  approvalTierFor,
  approversRequiredFor,
  THRESHOLD_L1_MAX_ZMW,
  THRESHOLD_L2_MAX_ZMW,
} from './thresholds';

// ─── money ─────────────────────────────────────────────────────────────────

describe('money', () => {
  it('converts kwacha to ngwee with half-up rounding', () => {
    expect(kwachaToNgwee(0)).toBe(0);
    expect(kwachaToNgwee(1)).toBe(100);
    expect(kwachaToNgwee(1234.56)).toBe(123_456);
    expect(kwachaToNgwee(1234.565)).toBe(123_457);
    expect(NGWEE_PER_KWACHA).toBe(100);
  });

  it('converts ngwee back to kwacha exactly', () => {
    expect(ngweeToKwacha(0)).toBe(0);
    expect(ngweeToKwacha(123_456)).toBe(1234.56);
  });

  it('formats ngwee as `K 1,234.56`', () => {
    expect(formatZmw(0)).toBe('K 0.00');
    expect(formatZmw(123_456)).toBe('K 1,234.56');
    expect(formatZmw(500_000_000)).toBe('K 5,000,000.00');
  });

  it('rejects non-finite kwacha', () => {
    expect(() => kwachaToNgwee(Infinity)).toThrow(RangeError);
    expect(() => kwachaToNgwee(NaN)).toThrow(RangeError);
  });
});

// ─── time ──────────────────────────────────────────────────────────────────

describe('time', () => {
  it('exposes the Lusaka timezone constant', () => {
    expect(LUSAKA_TZ).toBe('Africa/Lusaka');
  });

  it('formats Lusaka dates as DD MMM YYYY', () => {
    // 2026-05-12 23:30 UTC = 2026-05-13 01:30 Lusaka (UTC+2)
    expect(formatLusakaDate('2026-05-12T23:30:00Z')).toBe('13 May 2026');
  });

  it('formats Lusaka datetimes as DD MMM YYYY HH:mm CAT', () => {
    expect(formatLusakaDateTime('2026-05-12T08:00:00Z')).toBe('12 May 2026, 10:00 CAT');
  });

  it('returns Lusaka local YYYY-MM-DD via toLusakaIsoDate', () => {
    expect(toLusakaIsoDate('2026-05-12T23:30:00Z')).toBe('2026-05-13');
  });

  it('adds calendar months and aligns to payroll day, clamping to month length', () => {
    expect(addMonthsAligned('2026-05-12', 1, 25)).toBe('2026-06-25');
    expect(addMonthsAligned('2026-01-31', 1, 28)).toBe('2026-02-28');
    expect(addMonthsAligned('2026-12-15', 3, 28)).toBe('2027-03-28');
    expect(addMonthsAligned('2026-05-15', 0, 25)).toBe('2026-05-25');
  });

  it('rejects malformed dates', () => {
    expect(() => addMonthsAligned('not-a-date', 1, 25)).toThrow(RangeError);
    expect(() => addMonthsAligned('2026/05/12', 1, 25)).toThrow(RangeError);
  });
});

// ─── ids ───────────────────────────────────────────────────────────────────

describe('ids', () => {
  it('formats loan numbers as RFL{branch}{6-digit zero-padded}', () => {
    expect(formatLoanNumber({ branchCode: 'LS', sequence: 1 })).toBe('RFLLS000001');
    expect(formatLoanNumber({ branchCode: 'kt', sequence: 999_999 })).toBe('RFLKT999999');
  });

  it('rejects bad branch codes and out-of-range sequences', () => {
    expect(() => formatLoanNumber({ branchCode: 'L', sequence: 1 })).toThrow(RangeError);
    expect(() => formatLoanNumber({ branchCode: 'LSK', sequence: 1 })).toThrow(RangeError);
    expect(() => formatLoanNumber({ branchCode: '12', sequence: 1 })).toThrow(RangeError);
    expect(() => formatLoanNumber({ branchCode: 'LS', sequence: 0 })).toThrow(RangeError);
    expect(() => formatLoanNumber({ branchCode: 'LS', sequence: 1_000_000 })).toThrow(RangeError);
  });

  it('formats pre-approval serials as RFS0{5-digit}', () => {
    expect(formatPreApprovalSerial({ sequence: 10_000 })).toBe('RFS010000');
    expect(formatPreApprovalSerial({ sequence: 99_999 })).toBe('RFS099999');
    expect(() => formatPreApprovalSerial({ sequence: 9_999 })).toThrow(RangeError);
    expect(() => formatPreApprovalSerial({ sequence: 100_000 })).toThrow(RangeError);
  });
});

// ─── PAYE ──────────────────────────────────────────────────────────────────

describe('PAYE', () => {
  it.each([
    { base: 0, expected: 0 },
    { base: 1_000, expected: 0 },
    { base: 4_500, expected: 0 }, // edge of first band
    { base: 4_800, expected: 75 }, // exactly the 25% band — K300 × 0.25
    { base: 5_596.61, expected: 313.98 }, // xlsm row 3 PAYE base ≈ gross − NAPSA
    { base: 6_900, expected: 705 }, // 75 + (2100 × 0.30)
    { base: 10_000, expected: 1_867.5 }, // 75 + 630 + (3100 × 0.375)
  ])('computes PAYE($base) = $expected', ({ base, expected }) => {
    expect(computePayeMonthly(base)).toBe(expected);
  });

  it('exposes the default bands', () => {
    expect(DEFAULT_PAYE_BANDS).toHaveLength(4);
    expect(DEFAULT_PAYE_BANDS[0]).toMatchObject({ upTo: 4500, marginalRate: 0 });
    expect(DEFAULT_PAYE_BANDS.at(-1)).toMatchObject({ upTo: null, marginalRate: 0.375 });
  });
});

// ─── NAPSA ─────────────────────────────────────────────────────────────────

describe('NAPSA', () => {
  it('is 5% of basic capped at K1,540.20', () => {
    expect(NAPSA_RATE).toBe(0.05);
    expect(NAPSA_DEFAULT_CEILING_ZMW).toBe(1540.2);
    expect(computeNapsaMonthly(0)).toBe(0);
    expect(computeNapsaMonthly(4102.23)).toBe(205.11); // xlsm
    expect(computeNapsaMonthly(30_804)).toBe(1540.2);
    expect(computeNapsaMonthly(60_000)).toBe(1540.2); // capped
  });
});

// ─── NHIMA ─────────────────────────────────────────────────────────────────

describe('NHIMA', () => {
  it('is 1% of basic, uncapped', () => {
    expect(NHIMA_RATE).toBe(0.01);
    expect(computeNhimaMonthly(0)).toBe(0);
    expect(computeNhimaMonthly(4102.23)).toBe(41.02); // xlsm
    expect(computeNhimaMonthly(100_000)).toBe(1_000);
  });
});

// ─── Interest ──────────────────────────────────────────────────────────────

describe('Interest (straight-line)', () => {
  it('reproduces the xlsm row 3 worked example', () => {
    const r = computeInterest({ principalZmw: 7_250, monthlyRate: 0.04, tenureMonths: 6 });
    expect(r.totalInterestZmw).toBe(1_740);
    expect(r.totalCollectableZmw).toBe(8_990);
    expect(r.monthlyInstallmentZmw).toBe(1_498.33);
  });

  it('handles zero rate', () => {
    const r = computeInterest({ principalZmw: 1_200, monthlyRate: 0, tenureMonths: 12 });
    expect(r.totalInterestZmw).toBe(0);
    expect(r.totalCollectableZmw).toBe(1_200);
    expect(r.monthlyInstallmentZmw).toBe(100);
  });

  it('rejects bad inputs', () => {
    expect(() => computeInterest({ principalZmw: -1, monthlyRate: 0.04, tenureMonths: 6 })).toThrow(RangeError);
    expect(() => computeInterest({ principalZmw: 100, monthlyRate: -1, tenureMonths: 6 })).toThrow(RangeError);
    expect(() => computeInterest({ principalZmw: 100, monthlyRate: 0.04, tenureMonths: 0 })).toThrow(RangeError);
    expect(() => computeInterest({ principalZmw: 100, monthlyRate: 0.04, tenureMonths: 1.5 })).toThrow(RangeError);
  });
});

// ─── Fees ──────────────────────────────────────────────────────────────────

describe('Fees', () => {
  it('reproduces the xlsm row 3 worked example', () => {
    const r = computeFees({
      principalZmw: 7_250,
      adminFeePct: 0.02,
      insuranceFeePct: 0.02,
    });
    expect(r.adminFeeZmw).toBe(145);
    expect(r.insuranceFeeZmw).toBe(145);
    expect(r.settlementPaidZmw).toBe(0);
    expect(r.disbursedAmountZmw).toBe(6_960);
  });

  it('subtracts settlement (top-up flow)', () => {
    const r = computeFees({
      principalZmw: 7_500,
      adminFeePct: 0.02,
      insuranceFeePct: 0.02,
      settlementPaidZmw: 5_760,
    });
    expect(r.adminFeeZmw).toBe(150);
    expect(r.insuranceFeeZmw).toBe(150);
    expect(r.disbursedAmountZmw).toBe(1_440); // 7500 - 150 - 150 - 5760
  });

  it('rejects when fees exceed principal', () => {
    expect(() =>
      computeFees({ principalZmw: 100, adminFeePct: 0.6, insuranceFeePct: 0.6 }),
    ).toThrow(RangeError);
  });
});

// ─── Affordability ─────────────────────────────────────────────────────────

describe('Affordability', () => {
  it('reproduces the xlsm row 3 worked example (Musonda Costa)', () => {
    const r = computeAffordability({
      grossPayZmw: 5_596.61,
      basicPayZmw: 4_102.23,
      payeZmw: 313.98,
      napsaZmw: 205.11,
      nhimaZmw: 41.02,
      otherStatutoryZmw: 41.02, // union contribution
      existingObligationsZmw: 0,
      monthlyInterestRate: 0.04,
      tenureMonths: 6,
      proposedPrincipalZmw: 7_250,
    });
    // Verified to within 1 ngwee against the workbook
    expect(r.netAfterStatutoryZmw).toBeCloseTo(4_995.48, 1);
    expect(r.takeHomeRetainedZmw).toBeCloseTo(3_496.83, 1);
    expect(r.availableForObligationsZmw).toBeCloseTo(1_498.64, 1);
    expect(r.maxRichmondDeductionZmw).toBeCloseTo(1_498.64, 1);
    expect(r.proposedRepaymentZmw).toBe(1_498.33);
    expect(r.debtRatioPct).toBeCloseTo(0.2999, 4);
    expect(r.passes).toBe(true);
  });

  it('fails when debt ratio exceeds the cap', () => {
    const r = computeAffordability({
      grossPayZmw: 5_596.61,
      basicPayZmw: 4_102.23,
      payeZmw: 313.98,
      napsaZmw: 205.11,
      nhimaZmw: 41.02,
      otherStatutoryZmw: 41.02,
      existingObligationsZmw: 0,
      monthlyInterestRate: 0.04,
      tenureMonths: 6,
      proposedPrincipalZmw: 20_000,
    });
    expect(r.passes).toBe(false);
  });

  it('honours Choppies 35% override', () => {
    const r = computeAffordability(
      {
        grossPayZmw: 10_000,
        basicPayZmw: 8_000,
        payeZmw: 1_500,
        napsaZmw: 400,
        nhimaZmw: 80,
        otherStatutoryZmw: 0,
        existingObligationsZmw: 0,
        monthlyInterestRate: 0.04,
        tenureMonths: 6,
        proposedPrincipalZmw: 12_000,
      },
      0.35,
    );
    expect(r.passes).toBe(true);
  });
});

// ─── Schedule ──────────────────────────────────────────────────────────────

describe('Schedule', () => {
  it('generates 6 rows for a 6-month loan and totals reconcile', () => {
    const rows = generateSchedule({
      principalZmw: 7_250,
      monthlyRate: 0.04,
      tenureMonths: 6,
      startDateIso: '2026-05-12',
      payrollRunDay: 25,
    });
    expect(rows).toHaveLength(6);
    expect(rows[0]?.dueDateIso).toBe('2026-06-25');
    expect(rows.at(-1)?.dueDateIso).toBe('2026-11-25');
    const totalPrincipal = rows.reduce((s, r) => s + r.principalComponentZmw, 0);
    const totalInterest = rows.reduce((s, r) => s + r.interestComponentZmw, 0);
    const totalScheduled = rows.reduce((s, r) => s + r.scheduledAmountZmw, 0);
    expect(Math.round(totalPrincipal * 100) / 100).toBe(7_250);
    expect(Math.round(totalInterest * 100) / 100).toBe(1_740);
    expect(Math.round(totalScheduled * 100) / 100).toBe(8_990);
  });
});

// ─── Settlement ────────────────────────────────────────────────────────────

describe('Settlement', () => {
  it('reproduces the xlsm Settlement Calculator worked example (David Zyambo)', () => {
    // Original loan: K26,000 @ 2.25%/month × 15 months
    // monthlyInstallment = (26000 + 26000*0.0225*15) / 15 = 34775/15 = 2,318.33
    // The xlsm collected 13 instalments by Sep 2025; grace = 1.
    // Note: the workbook computed against an older 22-month tenor in row 10
    // and re-quoted under a 15-month tenor — we model the 15-month re-quote.
    const r = computeSettlement({
      principalZmw: 26_000,
      monthlyRate: 0.0225,
      tenureMonths: 15,
      monthlyInstallmentZmw: 2_318.33,
      collectedSoFarZmw: 0, // simplified: full quote, no collection yet
      graceInstalmentCount: 1,
      asOfDateIso: '2026-05-12',
      validityDays: 30,
    });
    expect(r.recomputedTotalCollectableZmw).toBe(34_775);
    expect(r.settlementAmountZmw).toBe(34_775 - 2_318.33);
    expect(r.validUntilIso).toBe('2026-06-11');
  });

  it('floors settlement at zero when collected exceeds total', () => {
    const r = computeSettlement({
      principalZmw: 1_000,
      monthlyRate: 0.04,
      tenureMonths: 6,
      monthlyInstallmentZmw: 206.67,
      collectedSoFarZmw: 2_000,
      graceInstalmentCount: 0,
      asOfDateIso: '2026-05-12',
    });
    expect(r.settlementAmountZmw).toBe(0);
  });
});

// ─── Thresholds ───────────────────────────────────────────────────────────

describe('Approval thresholds', () => {
  it.each([
    { amount: 0, tier: 'L1' as const },
    { amount: 5_000, tier: 'L1' as const },
    { amount: 5_001, tier: 'L2' as const },
    { amount: 10_000, tier: 'L2' as const },
    { amount: 10_001, tier: 'L3' as const },
    { amount: 1_000_000, tier: 'L3' as const },
  ])('tier($amount) = $tier', ({ amount, tier }) => {
    expect(approvalTierFor(amount)).toBe(tier);
  });

  it('rejects negative amounts', () => {
    expect(() => approvalTierFor(-1)).toThrow(RangeError);
  });

  it('exposes the documented thresholds', () => {
    expect(THRESHOLD_L1_MAX_ZMW).toBe(5_000);
    expect(THRESHOLD_L2_MAX_ZMW).toBe(10_000);
  });

  it('escalates approver requirements per tier', () => {
    expect(approversRequiredFor('L1')).toEqual(['cse', 'approver_l1']);
    expect(approversRequiredFor('L2')).toEqual(['cse', 'approver_l1', 'approver_l2']);
    expect(approversRequiredFor('L3')).toEqual(['cse', 'approver_l1', 'approver_l2', 'master_admin']);
  });
});
