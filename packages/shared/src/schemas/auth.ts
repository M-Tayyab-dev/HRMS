import { z } from 'zod';
import { ROLES, ALL_PERMISSIONS } from '../permissions';
import { MODULES } from '../modules';
import { currencyCode, password, timeZone, trimmed } from './common';

export const workspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, '3–40 lowercase letters, numbers or dashes');

/**
 * A new client company and its first Super Admin. Only platform owners can create companies (no public sign-up).
 * Without a password the Super Admin receives an invite email to set one.
 */
export const createCompanySchema = z.object({
  companyName: trimmed(2, 120),
  workspace: workspaceSlug,
  adminName: trimmed(2, 120),
  email: z.email().toLowerCase(),
  password: password.optional(),
  mustChangePassword: z.boolean().default(true),
  /** Subscription plan; its modules and employee limit are copied to the company. */
  planId: z.uuid().optional(),
  timezone: timeZone.default('Asia/Karachi'),
  currency: currencyCode.default('PKR'),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const platformLoginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const platformAdminSchema = z.object({
  name: trimmed(2, 120),
  email: z.email().toLowerCase(),
  password,
});

export const companyStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

/** Platform owner edits a company's subscription. `modules` may differ from the plan (custom deal). */
export const companyUpdateSchema = z.object({
  name: trimmed(2, 120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  planId: z.uuid().nullable().optional(),
  modules: z.array(z.enum(MODULES)).optional(),
  maxEmployees: z.coerce.number().int().min(1).max(100000).nullable().optional(),
});
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

/** A subscription plan sold to companies. */
export const planSchema = z.object({
  name: trimmed(2, 60),
  description: z.string().trim().max(300).optional().transform((v) => v || undefined),
  priceMonthly: z.coerce.number().min(0).max(100_000_000),
  currency: currencyCode.default('PKR'),
  modules: z.array(z.enum(MODULES)),
  maxEmployees: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type PlanInput = z.infer<typeof planSchema>;

export const testEmailSchema = z.object({ to: z.email() });

export const loginSchema = z.object({
  workspace: workspaceSlug,
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  workspace: workspaceSlug,
  email: z.email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

export const setUserRolesSchema = z.object({
  roles: z.array(z.enum(ROLES)).min(1),
});

export const setUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const adminSetPasswordSchema = z.object({
  password,
  mustChange: z.boolean().default(true),
});

export const rolePermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])),
});
