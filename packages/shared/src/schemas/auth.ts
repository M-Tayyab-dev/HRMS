import { z } from 'zod';
import { ROLES, ALL_PERMISSIONS } from '../permissions';
import { password, trimmed } from './common';

export const workspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, '3–40 lowercase letters, numbers or dashes');

export const signupSchema = z.object({
  companyName: trimmed(2, 120),
  workspace: workspaceSlug,
  adminName: trimmed(2, 120),
  email: z.email().toLowerCase(),
  password,
  timezone: z.string().default('Asia/Karachi'),
  currency: z.string().length(3).default('PKR'),
});
export type SignupInput = z.infer<typeof signupSchema>;

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
