import { z } from 'zod';
import { COMPENSATION_TYPES, PUNCH_TYPES } from '../enums';
import { isoDate, isoDateTime, optionalText, period, time, trimmed, uuid } from './common';

export const workScheduleSchema = z.object({
  name: trimmed(2, 80),
  startTime: time,
  endTime: time,
  breakMinutes: z.coerce.number().int().min(0).max(240),
  graceMinutes: z.coerce.number().int().min(0).max(120),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1), // 0 = Sunday
  isDefault: z.boolean().default(false),
});
export type WorkScheduleInput = z.infer<typeof workScheduleSchema>;

/** Biometric device push (C1). */
export const devicePunchSchema = z.object({
  punches: z
    .array(
      z.object({
        employeeCode: z.string().trim().min(1).max(40),
        at: isoDateTime,
        type: z.enum(PUNCH_TYPES).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

export const manualPunchSchema = z.object({
  employeeId: uuid,
  at: isoDateTime,
  type: z.enum(PUNCH_TYPES),
  note: optionalText(300),
});

export const attendanceQuery = z.object({
  from: isoDate,
  to: isoDate,
  employeeId: uuid.optional(),
  departmentId: uuid.optional(),
});

export const attendanceCorrectionSchema = z.object({
  date: isoDate,
  checkIn: time.optional(),
  checkOut: time.optional(),
  reason: trimmed(5, 1000),
}).refine((v) => v.checkIn || v.checkOut, { message: 'Provide check-in or check-out', path: ['checkIn'] });

export const overtimeDecisionSchema = z.object({
  approve: z.boolean(),
  workDescription: optionalText(1000),
  approvedMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  comment: optionalText(1000),
}).refine((v) => !v.approve || (v.workDescription && v.workDescription.length >= 5), {
  message: 'Describe the work performed during overtime',
  path: ['workDescription'],
});

export const compensationRequestSchema = z.object({
  type: z.enum(COMPENSATION_TYPES),
  minutes: z.coerce.number().int().min(30).max(100 * 60),
  date: isoDate.optional(), // required for HALF_DAY
  reason: trimmed(5, 1000),
}).refine((v) => v.type !== 'HALF_DAY' || !!v.date, { message: 'Pick the half-day date', path: ['date'] });

export const leaveTypeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z_]{2,20}$/),
  name: trimmed(2, 60),
  annualAllowance: z.coerce.number().min(0).max(365),
  isPaid: z.boolean().default(true),
  derivedFromOvertime: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1e3a8a'),
  isActive: z.boolean().default(true),
});

export const leaveRequestSchema = z
  .object({
    leaveTypeId: uuid,
    startDate: isoDate,
    endDate: isoDate,
    halfDay: z.boolean().default(false),
    reason: trimmed(3, 1000),
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'End date must be on or after start date', path: ['endDate'] })
  .refine((v) => !v.halfDay || v.startDate === v.endDate, { message: 'Half day must be a single date', path: ['halfDay'] });
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveCancelSchema = z.object({ reason: trimmed(5, 1000) });

export const leaveAllocationSchema = z.object({
  employeeId: uuid,
  leaveTypeId: uuid,
  year: z.coerce.number().int().min(2000).max(2100),
  days: z.coerce.number().min(-365).max(365),
  reason: trimmed(3, 300),
});

export const holidaySchema = z.object({
  name: trimmed(2, 100),
  date: isoDate,
  type: z.enum(['PUBLIC', 'COMPANY']),
  departmentId: uuid.nullable().optional(),
});

export const calendarEventSchema = z
  .object({
    title: trimmed(2, 150),
    description: optionalText(2000),
    startDate: isoDate,
    endDate: isoDate,
    visibility: z.enum(['COMPANY', 'DEPARTMENT']),
    departmentId: uuid.nullable().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'End must be on or after start', path: ['endDate'] })
  .refine((v) => v.visibility === 'COMPANY' || !!v.departmentId, { message: 'Pick a department', path: ['departmentId'] });

export const calendarQuery = z.object({
  month: period,
  employeeId: uuid.optional(),
  departmentId: uuid.optional(),
});
