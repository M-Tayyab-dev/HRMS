import type { AttendanceStatus, PunchType } from '@hrms/shared';
import { dayOfWeek, localMinutes, timeToMinutes } from '../../common/tz';

export interface Schedule {
  startTime: string; // HH:MM
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  workingDays: number[];
}

export interface Punch {
  at: Date;
  type?: PunchType | null;
  source: 'DEVICE' | 'IMPORT' | 'MANUAL' | 'CORRECTION';
}

export interface DayInput {
  date: string;
  tz: string;
  schedule: Schedule;
  punches: Punch[];
  isHoliday: boolean;
  /** Approved leave covering this day: none, a full day, or half a day. */
  leave: 'NONE' | 'FULL' | 'HALF';
  /** Approved half-day compensation using overtime (C2). */
  compensationHalfDay: boolean;
  overtimeThresholdMinutes: number;
  /** Date is today or later – no punches yet doesn't mean absent. */
  isFuture: boolean;
}

export interface DayResult {
  checkIn: Date | null;
  checkOut: Date | null;
  breakMinutes: number;
  workedMinutes: number;
  scheduledMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  skippedBreak: boolean;
  earlyLeave: boolean;
  status: AttendanceStatus | 'PENDING';
}

/** Net scheduled minutes for a working day (span minus break). */
export function scheduledNetMinutes(s: Schedule): number {
  let span = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
  if (span <= 0) span += 24 * 60; // overnight shift
  return Math.max(0, span - s.breakMinutes);
}

/**
 * Turns raw punches into a daily attendance record (C1, C2, C5).
 *  - First punch = check-in, last punch = check-out; approved corrections override either end.
 *  - Breaks come from explicit BREAK_START/END punches, or gaps between OUT/IN pairs.
 *  - If no break was taken the employee may leave early by the break length (C1 rule).
 */
export function computeDay(input: DayInput): DayResult {
  const { schedule: s, tz } = input;
  const workingDay = s.workingDays.includes(dayOfWeek(input.date)) && !input.isHoliday;
  let scheduled = workingDay ? scheduledNetMinutes(s) : 0;
  if (input.leave === 'FULL') scheduled = 0;
  if (input.leave === 'HALF' || input.compensationHalfDay) scheduled = Math.round(scheduled / 2);

  const empty: DayResult = {
    checkIn: null,
    checkOut: null,
    breakMinutes: 0,
    workedMinutes: 0,
    scheduledMinutes: scheduled,
    lateMinutes: 0,
    overtimeMinutes: 0,
    skippedBreak: false,
    earlyLeave: false,
    status: 'ABSENT',
  };

  const sorted = [...input.punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.length === 0) {
    if (input.isHoliday) return { ...empty, status: 'HOLIDAY' };
    if (input.leave === 'FULL') return { ...empty, status: 'ON_LEAVE' };
    if (!workingDay) return { ...empty, status: 'WEEKEND' };
    if (input.isFuture) return { ...empty, status: 'PENDING' };
    return { ...empty, status: input.leave === 'HALF' ? 'ON_LEAVE' : 'ABSENT' };
  }

  const corrIn = sorted.find((p) => p.source === 'CORRECTION' && p.type === 'IN');
  const corrOut = [...sorted].reverse().find((p) => p.source === 'CORRECTION' && p.type === 'OUT');
  const regular = sorted.filter((p) => p.source !== 'CORRECTION');

  const checkIn = corrIn?.at ?? regular[0]?.at ?? sorted[0]!.at;
  const lastRegular = regular.length > 1 ? regular[regular.length - 1]!.at : null;
  const checkOut = corrOut?.at ?? lastRegular;

  // Breaks
  let breakMinutes = 0;
  const explicitStarts = regular.filter((p) => p.type === 'BREAK_START');
  if (explicitStarts.length) {
    for (const start of explicitStarts) {
      const end = regular.find((p) => p.type === 'BREAK_END' && p.at > start.at);
      if (end) breakMinutes += Math.round((end.at.getTime() - start.at.getTime()) / 60_000);
    }
  } else if (regular.length >= 4) {
    // Untyped punches: IN, OUT, IN, OUT … → gaps between pairs are breaks.
    for (let i = 1; i + 1 < regular.length; i += 2) {
      breakMinutes += Math.round((regular[i + 1]!.at.getTime() - regular[i]!.at.getTime()) / 60_000);
    }
  }

  if (!checkOut || checkOut <= checkIn) {
    // Still at work (or a single punch).
    const late = workingDay ? Math.max(0, localMinutes(checkIn, tz) - timeToMinutes(s.startTime)) : 0;
    const isLate = late > s.graceMinutes;
    return {
      ...empty,
      checkIn,
      lateMinutes: isLate ? late : 0,
      status: input.isFuture ? (isLate ? 'LATE' : 'PRESENT') : 'LATE', // missing check-out = irregular
    };
  }

  const span = Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000);
  const worked = Math.max(0, span - breakMinutes);
  const skippedBreak = workingDay && s.breakMinutes > 0 && breakMinutes === 0;

  const startMin = timeToMinutes(s.startTime);
  const late = workingDay ? Math.max(0, localMinutes(checkIn, tz) - startMin) : 0;
  const isLate = late > s.graceMinutes;

  // Leaving before the scheduled end is fine when the required net minutes were worked
  // (e.g. skipped break → leave early by the break length).
  const earlyLeave = workingDay && scheduled > 0 && worked < scheduled;

  let overtime = workingDay ? Math.max(0, worked - scheduled) : worked;
  if (overtime < input.overtimeThresholdMinutes) overtime = 0;

  let status: AttendanceStatus;
  if (input.isHoliday) status = 'HOLIDAY';
  else if (input.leave === 'FULL') status = 'ON_LEAVE';
  else if (input.leave === 'HALF' || input.compensationHalfDay) status = 'HALF_DAY';
  else if (!workingDay) status = 'WEEKEND';
  else if (isLate || earlyLeave) status = 'LATE';
  else status = 'PRESENT';

  return {
    checkIn,
    checkOut,
    breakMinutes,
    workedMinutes: worked,
    scheduledMinutes: scheduled,
    lateMinutes: isLate ? late : 0,
    overtimeMinutes: overtime,
    skippedBreak,
    earlyLeave,
    status,
  };
}
