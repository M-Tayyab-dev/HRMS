import { z } from 'zod';
import { ROLES, ALL_PERMISSIONS } from '../permissions';
import { password, trimmed } from './common';

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
  timezone: z.string().min(3).max(60).default('Asia/Karachi'),
  currency: z.string().length(3).toUpperCase().default('PKR'),
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
