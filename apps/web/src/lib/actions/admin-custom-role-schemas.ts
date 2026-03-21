/**
 * Zod schemas for admin-custom-roles actions (A4.1)
 * Split out to keep admin-custom-roles.ts under 300 lines.
 */

import { z } from 'zod';

const permissionSchema = z.object({
  subject: z.string().min(1),
  action: z.string().min(1),
}).strict();

export const createCustomRoleSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z0-9 ]+$/, 'Name must be alphanumeric with spaces only'),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).default([]),
}).strict();

export const updateCustomRoleSchema = z.object({
  customRoleId: z.string().min(1),
  name: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9 ]+$/, 'Name must be alphanumeric with spaces only')
    .optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionSchema).optional(),
}).strict();

export const deleteCustomRoleSchema = z.object({
  customRoleId: z.string().min(1),
}).strict();

export const assignCustomRoleSchema = z.object({
  staffUserId: z.string().min(1),
  customRoleId: z.string().min(1),
}).strict();

export const revokeCustomRoleSchema = z.object({
  staffUserId: z.string().min(1),
  customRoleId: z.string().min(1),
}).strict();
