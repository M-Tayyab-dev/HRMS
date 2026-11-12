import { z } from 'zod';
import {
  COMMUNITY_POSTING_MODES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  INCENTIVE_TYPES,
  POLICY_CATEGORIES,
  QUERY_CATEGORIES,
  QUERY_STATUSES,
  SURVEY_AUDIENCES,
  SURVEY_KINDS,
  SURVEY_QUESTION_TYPES,
} from '../enums';
import { currencyCode, money, optionalText, period, timeZone, trimmed, uuid } from './common';

/* ---------- E. Performance ---------- */
export const kpiTargetSchema = z.object({
  employeeId: uuid,
  period,
  metric: trimmed(2, 80),
  unit: trimmed(1, 20).default('PKR'),
  targetValue: z.coerce.number().min(0),
  incentiveType: z.enum(INCENTIVE_TYPES).default('PERCENT_OF_EXCESS'),
  incentiveValue: z.coerce.number().min(0).default(0),
});

export const kpiSubmissionSchema = z.object({
  targetId: uuid.optional(),
  period,
  metric: trimmed(2, 80),
  achievedValue: z.coerce.number().min(0),
  notes: optionalText(2000),
});

export const kpiDecisionSchema = z.object({
  approve: z.boolean(),
  remarks: optionalText(2000),
});

/* ---------- Surveys (E3, F7) ---------- */
export const surveyQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SURVEY_QUESTION_TYPES),
  label: trimmed(2, 300),
  options: z.array(trimmed(1, 120)).max(20).optional(),
  required: z.boolean().default(true),
});

export const surveySchema = z
  .object({
    title: trimmed(3, 150),
    description: optionalText(2000),
    kind: z.enum(SURVEY_KINDS),
    audience: z.enum(SURVEY_AUDIENCES),
    audienceId: uuid.nullable().optional(),
    subjectEmployeeId: uuid.nullable().optional(),
    anonymous: z.boolean().default(false),
    questions: z.array(surveyQuestionSchema).min(1).max(50),
  })
  .refine((s) => s.audience === 'ALL' || !!s.audienceId, { message: 'Pick a department or team', path: ['audienceId'] })
  .refine(
    (s) => s.questions.every((q) => !['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(q.type) || (q.options?.length ?? 0) >= 2),
    { message: 'Choice questions need at least two options', path: ['questions'] },
  );
export type SurveyInput = z.infer<typeof surveySchema>;

export const surveyResponseSchema = z.object({
  answers: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.array(z.string().max(200))])),
});

/* ---------- F. Compliance ---------- */
export const policySchema = z.object({
  category: z.enum(POLICY_CATEGORIES),
  title: trimmed(3, 150),
  summary: optionalText(1000),
  content: optionalText(100_000),
});

export const guidelinesSchema = z.object({ content: trimmed(20, 50_000) });

export const complaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  description: trimmed(20, 10_000),
});

export const complaintUpdateSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  resolutionNote: optionalText(5000),
});

export const complaintTrackSchema = z.object({ trackingCode: z.string().trim().min(10).max(64) });

export const querySchema = z.object({
  subject: trimmed(3, 150),
  category: z.enum(QUERY_CATEGORIES).default('GENERAL'),
  body: trimmed(5, 5000),
});

export const queryMessageSchema = z.object({ body: trimmed(1, 5000) });
export const queryStatusSchema = z.object({ status: z.enum(QUERY_STATUSES) });

/* ---------- G. Community ---------- */
export const postSchema = z.object({
  body: trimmed(1, 5000),
  departmentId: uuid.nullable().optional(),
});

export const announcementSchema = z.object({
  title: trimmed(3, 150),
  body: trimmed(3, 10_000),
  departmentId: uuid.nullable().optional(),
  pinned: z.boolean().default(false),
});

export const commentSchema = z.object({ body: trimmed(1, 2000) });

export const communitySettingsSchema = z.object({
  postingMode: z.enum(COMMUNITY_POSTING_MODES),
  engagementEnabled: z.boolean(),
});

export const grantPostingSchema = z.object({ canPost: z.boolean() });

/* ---------- Tenant settings ---------- */
export const tenantSettingsSchema = z.object({
  name: trimmed(2, 120).optional(),
  timezone: timeZone.optional(),
  currency: currencyCode.optional(),
  directoryShowJoinDate: z.boolean().optional(),
  /** SEC-03: inactivity timeout (minutes), managed by Operations. */
  sessionIdleMinutes: z.coerce.number().int().min(5).max(480).optional(),
  medicalAnnualLimit: money.optional(),
  overtimeThresholdMinutes: z.coerce.number().int().min(0).max(600).optional(),
  payrollWorkingHoursBased: z.boolean().optional(),
});
export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;
