import { z } from 'zod';

export const createNotificationTemplateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_.]*$/, 'Key must be lowercase dot-separated identifier'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().min(1).max(100),
  subjectTemplate: z.string().max(1000).nullable().optional(),
  bodyTemplate: z.string().min(1).max(10000),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(z.enum(['EMAIL', 'PUSH', 'IN_APP', 'SMS'])).min(1),
  isSystemOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).strict();

export const updateNotificationTemplateSchema = z.object({
  templateId: z.string().cuid2(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().min(1).max(100).optional(),
  subjectTemplate: z.string().max(1000).nullable().optional(),
  bodyTemplate: z.string().min(1).max(10000).optional(),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(z.enum(['EMAIL', 'PUSH', 'IN_APP', 'SMS'])).min(1).optional(),
  isSystemOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const deleteNotificationTemplateSchema = z.object({
  templateId: z.string().cuid2(),
}).strict();

export const toggleNotificationTemplateSchema = z.object({
  templateId: z.string().cuid2(),
  isActive: z.boolean(),
}).strict();
