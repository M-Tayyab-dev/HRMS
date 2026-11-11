import type { PayslipLine } from '../../db/schema';
import { round2 } from '../../common/util';

export interface AttendanceDayLite {
  date: string;
  status: string;
  workedMinutes: number;
  scheduledMinutes: number;
  workFromHome: boolean;
  earlyLeave: boolean;
}

export interface ComponentLite {
  kind: 'ALLOWANCE' | 'DEDUCTION';
  code: string;
  label: string;
  amount: number;
  isPercentOfBasic: boolean;
}

export interface FoodRuleLite {
  dailyAmount: number;
  minWorkedMinutes: number;
  excludeWorkFromHome: boolean;
  excludeEarlyLeave: boolean;
}

export interface PayslipInput {
  basicSalary: number;
  /** Net working minutes for every working day of the month (rate basis). */
  fullMonthMinutes: number;
  /** Net working minutes for the days the person was employed this month. */
  employedMinutes: number;
  /** Minutes the person should be paid for (worked + paid leave + credited half-days), capped per day. */
  payableMinutes: number;
  workingHoursBased: boolean;
  components: ComponentLite[];
  food: { rule: FoodRuleLite; days: AttendanceDayLite[] } | null;
  paidOvertimeMinutes: number;
  incentives: { id: string; amount: number; label: string }[];
  medical: { id: string; amount: number }[];
  loans: { id: string; installment: number; outstanding: number }[];
  manual: PayslipLine[];
}

export interface PayslipResult {
  earnedBasic: number;
  totalAllowances: number;
  totalDeductions: number;
  gross: number;
  net: number;
  lines: PayslipLine[];
  loanDeductions: { loanId: string; amount: number }[];
  foodDays: number;
}

/** D4: eligible only when the required hours were worked on-site without leaving early. */
export function foodEligibleDays(rule: FoodRuleLite, days: AttendanceDayLite[]): number {
  return days.filter(
    (d) =>
      ['PRESENT', 'LATE'].includes(d.status) &&
      d.workedMinutes >= rule.minWorkedMinutes &&
      !(rule.excludeWorkFromHome && d.workFromHome) &&
      !(rule.excludeEarlyLeave && d.earlyLeave),
  ).length;
}

export function calcPayslip(i: PayslipInput): PayslipResult {
  const lines: PayslipLine[] = [];
  const ratePerMinute = i.fullMonthMinutes > 0 ? i.basicSalary / i.fullMonthMinutes : 0;

  // D1: working-hours-based basic pay (otherwise prorated only by employment days).
  const basisMinutes = i.workingHoursBased ? Math.min(i.payableMinutes, i.employedMinutes) : i.employedMinutes;
  const earnedBasic = round2(Math.min(i.basicSalary, ratePerMinute * basisMinutes));
  lines.push({ kind: 'EARNING', code: 'BASIC', label: 'Basic salary', amount: earnedBasic });

  for (const c of i.components) {
    const amount = round2(c.isPercentOfBasic ? (i.basicSalary * c.amount) / 100 : c.amount);
    if (amount > 0) lines.push({ kind: c.kind === 'ALLOWANCE' ? 'ALLOWANCE' : 'DEDUCTION', code: c.code, label: c.label, amount });
  }

  let foodDays = 0;
  if (i.food) {
    foodDays = foodEligibleDays(i.food.rule, i.food.days);
    if (foodDays > 0) lines.push({ kind: 'ALLOWANCE', code: 'FOOD', label: `Food allowance (${foodDays} days)`, amount: round2(foodDays * i.food.rule.dailyAmount) });
  }

  if (i.paidOvertimeMinutes > 0) {
    lines.push({ kind: 'ALLOWANCE', code: 'OVERTIME', label: `Overtime (${Math.round(i.paidOvertimeMinutes / 6) / 10}h)`, amount: round2(ratePerMinute * i.paidOvertimeMinutes) });
  }
  for (const inc of i.incentives) lines.push({ kind: 'BONUS', code: 'INCENTIVE', label: inc.label, amount: round2(inc.amount) });
  const medicalTotal = i.medical.reduce((a, m) => a + m.amount, 0);
  if (medicalTotal > 0) lines.push({ kind: 'ALLOWANCE', code: 'MEDICAL', label: 'Medical reimbursement', amount: round2(medicalTotal) });

  for (const m of i.manual) lines.push({ ...m, manual: true });

  const sum = (kinds: PayslipLine['kind'][]) => round2(lines.filter((l) => kinds.includes(l.kind)).reduce((a, l) => a + l.amount, 0));
  const totalAllowances = sum(['ALLOWANCE', 'BONUS']);
  const gross = round2(earnedBasic + totalAllowances);
  let deductions = sum(['DEDUCTION']);

  // D2: loan instalments, never pushing net pay below zero.
  const loanDeductions: { loanId: string; amount: number }[] = [];
  for (const loan of i.loans) {
    const room = Math.max(0, gross - deductions);
    const amount = round2(Math.min(loan.installment, loan.outstanding, room));
    if (amount <= 0) continue;
    loanDeductions.push({ loanId: loan.id, amount });
    lines.push({ kind: 'DEDUCTION', code: 'LOAN', label: 'Loan repayment', amount });
    deductions = round2(deductions + amount);
  }

  const net = round2(Math.max(0, gross - deductions));
  return { earnedBasic, totalAllowances, totalDeductions: deductions, gross, net, lines, loanDeductions, foodDays };
}
