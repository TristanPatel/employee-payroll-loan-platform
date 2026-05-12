/**
 * Repayment schedule generator. For instalment N (1..tenureMonths):
 *   dueDate          = startDate + N months aligned to employer.payrollRunDay
 *   scheduledAmount  = monthlyInstallment
 *   principalShare   = principal / tenureMonths
 *   interestShare    = totalInterest / tenureMonths
 * Final instalment carries any residual cent so totals reconcile exactly.
 *
 * Full implementation lands in Phase 2.
 */

export interface ScheduleInputs {
  principalZmw: number;
  monthlyRate: number;
  tenureMonths: number;
  startDateIso: string; // ISO date in Lusaka local time
  payrollRunDay: number; // 1..28
}

export interface ScheduleRow {
  instalmentNo: number;
  dueDateIso: string;
  scheduledAmountZmw: number;
  principalComponentZmw: number;
  interestComponentZmw: number;
}

export function generateSchedule(_inputs: ScheduleInputs): ReadonlyArray<ScheduleRow> {
  throw new Error('Not implemented — Phase 2');
}
