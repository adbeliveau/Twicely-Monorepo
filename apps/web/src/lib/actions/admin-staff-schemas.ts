/**
 * Zod schemas and constants for admin-staff actions (A4)
 * Split out to keep admin-staff.ts under 300 lines.
 */

import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

export const PLATFORM_ROLES = [
  'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
  'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN',
] as const;

export const ELEVATED_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

export const createStaffUserSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  password: z.string().min(10).max(128),
  roles: z.array(z.enum(PLATFORM_ROLES)).min(1).max(10),
}).strict();

export const updateStaffUserSchema = z.object({
  staffUserId: zodId,
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
}).strict();

export const grantSystemRoleSchema = z.object({
  staffUserId: zodId,
  role: z.enum(PLATFORM_ROLES),
}).strict();

export const revokeSystemRoleSchema = z.object({
  staffUserId: zodId,
  role: z.enum(PLATFORM_ROLES),
}).strict();

export const deactivateStaffSchema = z.object({
  staffUserId: zodId,
  reason: z.string().min(1).max(500),
}).strict();

export const reactivateStaffSchema = z.object({
  staffUserId: zodId,
}).strict();

export const resetStaffPasswordSchema = z.object({
  staffUserId: zodId,
  newPassword: z.string().min(10).max(128),
}).strict();
