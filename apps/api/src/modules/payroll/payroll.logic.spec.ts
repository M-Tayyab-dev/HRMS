import { calcPayslip, foodEligibleDays, type PayslipInput } from './payroll.logic';

const base = (over: Partial<PayslipInput> = {}): PayslipInput => ({
  basicSalary: 100_000,
  fullMonthMinutes: 20 * 480,
  employedMinutes: 20 * 480,
  payableMinutes: 20 * 480,
  workingHoursBased: true,
  components: [],
  food: null,
  paidOvertimeMinutes: 0,
  incentives: [],
  medical: [],
  loans: [],
  manual: [],
  ...over,
});

describe('calcPayslip', () => {
  it('pays full basic for a full month', () => {
    const r = calcPayslip(base());
    expect(r.earnedBasic).toBe(100_000);
    expect(r.net).toBe(100_000);
  });

  it('reduces basic by unworked hours when working-hours based (D1)', () => {
    const r = calcPayslip(base({ payableMinutes: 19 * 480 }));
    expect(r.earnedBasic).toBe(95_000);
  });

  it('prorates joiners even when not hours-based', () => {
    const r = calcPayslip(base({ workingHoursBased: false, employedMinutes: 10 * 480, payableMinutes: 0 }));
    expect(r.earnedBasic).toBe(50_000);
  });

  it('never pays more than basic for extra hours (overtime is separate)', () => {
    const r = calcPayslip(base({ payableMinutes: 25 * 480 }));
    expect(r.earnedBasic).toBe(100_000);
  });

  it('applies fixed and percentage components', () => {
    const r = calcPayslip(
      base({
        components: [
          { kind: 'ALLOWANCE', code: 'HOUSE', label: 'House rent', amount: 10, isPercentOfBasic: true },
          { kind: 'DEDUCTION', code: 'TAX', label: 'Income tax', amount: 5000, isPercentOfBasic: false },
        ],
      }),
    );
    expect(r.totalAllowances).toBe(10_000);
    expect(r.gross).toBe(110_000);
    expect(r.net).toBe(105_000);
  });

  it('pays approved overtime at the hourly rate', () => {
    const r = calcPayslip(base({ paidOvertimeMinutes: 480 }));
    expect(r.lines.find((l) => l.code === 'OVERTIME')?.amount).toBe(5000);
  });

  it('deducts loan instalments without making net negative (D2)', () => {
    const r = calcPayslip(base({ basicSalary: 10_000, loans: [{ id: 'a', installment: 8000, outstanding: 20_000 }, { id: 'b', installment: 5000, outstanding: 5000 }] }));
    expect(r.loanDeductions).toEqual([
      { loanId: 'a', amount: 8000 },
      { loanId: 'b', amount: 2000 },
    ]);
    expect(r.net).toBe(0);
  });

  it('caps a loan instalment at the outstanding balance', () => {
    const r = calcPayslip(base({ loans: [{ id: 'a', installment: 8000, outstanding: 3000 }] }));
    expect(r.loanDeductions[0]?.amount).toBe(3000);
  });

  it('includes incentives, medical reimbursements and manual adjustments', () => {
    const r = calcPayslip(
      base({
        incentives: [{ id: 'i', amount: 7000, label: 'Sales incentive' }],
        medical: [{ id: 'm', amount: 2500 }],
        manual: [{ kind: 'DEDUCTION', code: 'ADJ', label: 'Advance', amount: 1000 }],
      }),
    );
    expect(r.gross).toBe(109_500);
    expect(r.net).toBe(108_500);
  });
});

describe('foodEligibleDays (D4)', () => {
  const rule = { dailyAmount: 300, minWorkedMinutes: 480, excludeWorkFromHome: true, excludeEarlyLeave: true };
  const day = (over: object) => ({ date: '2026-11-10', status: 'PRESENT', workedMinutes: 480, scheduledMinutes: 480, workFromHome: false, earlyLeave: false, ...over });

  it('counts days with required hours on-site', () => {
    expect(foodEligibleDays(rule, [day({}), day({ status: 'LATE' })])).toBe(2);
  });
  it('excludes short days, WFH and early leave', () => {
    expect(foodEligibleDays(rule, [day({ workedMinutes: 300 }), day({ workFromHome: true }), day({ earlyLeave: true }), day({ status: 'ABSENT' })])).toBe(0);
  });
});
