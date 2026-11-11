import { Injectable } from '@nestjs/common';
import type { LeaveRequestInput } from '@hrms/shared';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { currentUser } from '../../common/context';
import { badRequest } from '../../common/errors';
import { dayOfWeek, eachDay, todayIn } from '../../common/tz';
import { one, round2 } from '../../common/util';
import { DbService } from '../../db/db.service';
import { employees, holidays, leaveAllocations, leaveRequests, leaveTypes } from '../../db/schema';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class LeaveService {
  constructor(
    private readonly db: DbService,
    private readonly attendance: AttendanceService,
  ) {}

  /** Working days in range, excluding weekends (per schedule) and holidays. */
  async countDays(employeeId: string, start: string, end: string, halfDay: boolean): Promise<number> {
    const tx = this.db.tx;
    const schedule = await this.attendance.scheduleFor(employeeId);
    const [emp] = await tx.select({ dept: employees.departmentId }).from(employees).where(eq(employees.id, employeeId));
    const hols = await tx
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(gte(holidays.date, start), lte(holidays.date, end), or(isNull(holidays.departmentId), eq(holidays.departmentId, emp!.dept))));
    const set = new Set(hols.map((h) => h.date));
    const n = eachDay(start, end).filter((d) => schedule.workingDays.includes(dayOfWeek(d)) && !set.has(d)).length;
    return halfDay ? (n ? 0.5 : 0) : n;
  }

  async balances(employeeId: string, year: number) {
    const tx = this.db.tx;
    const types = await tx.select().from(leaveTypes).where(eq(leaveTypes.isActive, true)).orderBy(leaveTypes.code);
    const allocs = await tx
      .select({ typeId: leaveAllocations.leaveTypeId, days: sql<number>`sum(${leaveAllocations.days})::float` })
      .from(leaveAllocations)
      .where(and(eq(leaveAllocations.employeeId, employeeId), eq(leaveAllocations.year, year)))
      .groupBy(leaveAllocations.leaveTypeId);
    const usage = await tx
      .select({
        typeId: leaveRequests.leaveTypeId,
        status: leaveRequests.status,
        days: sql<number>`sum(${leaveRequests.days})::float`,
      })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.employeeId, employeeId), sql`extract(year from ${leaveRequests.startDate}) = ${year}`, inArray(leaveRequests.status, ['PENDING', 'APPROVED'])))
      .groupBy(leaveRequests.leaveTypeId, leaveRequests.status);
    const ot = await this.attendance.overtimeBalance(employeeId);

    return types.map((t) => {
      const used = usage.find((u) => u.typeId === t.id && u.status === 'APPROVED')?.days ?? 0;
      const pending = usage.find((u) => u.typeId === t.id && u.status === 'PENDING')?.days ?? 0;
      if (t.derivedFromOvertime) {
        // Compensation leave comes from approved overtime (C3); pending/used is already netted out.
        const available = ot.dayMinutes ? Math.floor((ot.availableMinutes / ot.dayMinutes) * 2) / 2 : 0;
        return { leaveTypeId: t.id, code: t.code, name: t.name, color: t.color, isPaid: t.isPaid, derivedFromOvertime: true, allocated: round2(available + used + pending), used, pending, available };
      }
      const allocated = t.annualAllowance + (allocs.find((a) => a.typeId === t.id)?.days ?? 0);
      return { leaveTypeId: t.id, code: t.code, name: t.name, color: t.color, isPaid: t.isPaid, derivedFromOvertime: false, allocated, used, pending, available: round2(allocated - used - pending) };
    });
  }

  async validateRequest(employeeId: string, input: LeaveRequestInput) {
    const tx = this.db.tx;
    const type = one(await tx.select().from(leaveTypes).where(eq(leaveTypes.id, input.leaveTypeId)), 'Leave type');
    if (!type.isActive) throw badRequest('This leave type is not available');
    if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) throw badRequest('Split leave that crosses into a new year into two requests');
    const days = await this.countDays(employeeId, input.startDate, input.endDate, input.halfDay);
    if (days <= 0) throw badRequest('The selected dates contain no working days');
    const [overlap] = await tx
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          inArray(leaveRequests.status, ['PENDING', 'APPROVED']),
          lte(leaveRequests.startDate, input.endDate),
          gte(leaveRequests.endDate, input.startDate),
        ),
      )
      .limit(1);
    if (overlap) throw badRequest('You already have leave during these dates', 'OVERLAP');
    const bal = (await this.balances(employeeId, Number(input.startDate.slice(0, 4)))).find((b) => b.leaveTypeId === type.id);
    if (type.isPaid && bal && days > bal.available) {
      throw badRequest(`Not enough ${type.name.toLowerCase()} balance (available: ${bal.available} day${bal.available === 1 ? '' : 's'})`, 'INSUFFICIENT_BALANCE');
    }
    return { type, days };
  }

  /** Approved/cancelled leave changes attendance automatically (C3). */
  async syncAttendance(employeeId: string, start: string, end: string) {
    const t = await this.attendance.tenant();
    const today = todayIn(t.timezone);
    if (start <= today) await this.attendance.recompute(employeeId, start, end < today ? end : today);
  }

  tenantId() {
    return currentUser().tenantId;
  }
}
