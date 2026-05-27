/**
 * Repayment schedule generator. For instalment N (1..tenureMonths):
 *   dueDate          = startDate + N months aligned to employer.payrollRunDay
 *   scheduledAmount  = monthlyInstallment
 *   principalShare   = principal / tenureMonths
 *   interestShare    = totalInterest / tenureMonths
 * Final instalment carries any sub-ngwee residue so totals reconcile exactly.
 */

import { addMonthsAligned } from '../time';
import { computeInterest } from './interest';

export interface ScheduleInputs {
  principalZmw: number;
  monthlyRate: number;
  tenureMonths: number;
  /** Loan start date as ISO YYYY-MM-DD (Lusaka local). */
  startDateIso: string;
  /** Day of month for payroll cut (1..28). */
  payrollRunDay: number;
}

export interface ScheduleRow {
  instalmentNo: number;
  dueDateIso: string;
  scheduledAmountZmw: number;
  principalComponentZmw: number;
  interestComponentZmw: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function generateSchedule(inputs: ScheduleInputs): ReadonlyArray<ScheduleRow> {
  const { principalZmw, monthlyRate, tenureMonths, startDateIso, payrollRunDay } = inputs;
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new RangeError(`generateSchedule: tenureMonths must be positive (got ${tenureMonths})`);
  }
  if (!Number.isInteger(payrollRunDay) || payrollRunDay < 1 || payrollRunDay > 28) {
    throw new RangeError(`generateSchedule: payrollRunDay must be 1..28 (got ${payrollRunDay})`);
  }

  const { totalInterestZmw, totalCollectableZmw, monthlyInstallmentZmw } = computeInterest({
    principalZmw,
    monthlyRate,
    tenureMonths,
  });

  const principalShareRaw = principalZmw / tenureMonths;
  const interestShareRaw = totalInterestZmw / tenureMonths;
  const principalShare = round2(principalShareRaw);
  const interestShare = round2(interestShareRaw);

  const rows: ScheduleRow[] = [];
  let principalAccum = 0;
  let interestAccum = 0;
  let collectableAccum = 0;

  for (let n = 1; n <= tenureMonths; n++) {
    const isLast = n === tenureMonths;
    const dueDate = addMonthsAligned(startDateIso, n, payrollRunDay);
    let principalComponent = principalShare;
    let interestComponent = interestShare;
    let scheduledAmount = monthlyInstallmentZmw;
    if (isLast) {
      principalComponent = round2(principalZmw - principalAccum);
      interestComponent = round2(totalInterestZmw - interestAccum);
      scheduledAmount = round2(totalCollectableZmw - collectableAccum);
    }
    rows.push({
      instalmentNo: n,
      dueDateIso: dueDate,
      scheduledAmountZmw: scheduledAmount,
      principalComponentZmw: principalComponent,
      interestComponentZmw: interestComponent,
    });
    principalAccum = round2(principalAccum + principalComponent);
    interestAccum = round2(interestAccum + interestComponent);
    collectableAccum = round2(collectableAccum + scheduledAmount);
  }

  return rows;
}
