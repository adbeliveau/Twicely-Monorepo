import { z } from 'zod';
import { zodId } from '@/lib/validation/schemas';

// Dotted key format: category.subcategory.name (1-3 segments)
const flagKeyRegex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){0,2}$/;

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(flagKeyRegex, 'Key must be dotted lowercase (e.g. feature.newCheckout)'),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'TARGETED']).default('BOOLEAN'),
  enabled: z.boolean().default(false),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.string(), z.unknown()).optional(),
}).strict().refine(
  (data) => data.type !== 'PERCENTAGE' || (data.percentage !== undefined && data.percentage !== null),
  { message: 'Percentage is required for PERCENTAGE type flags', path: ['percentage'] }
);

export const updateFeatureFlagSchema = z.object({
  flagId: zodId,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  percentage: z.number().int().min(0).max(100).optional(),
  targetingJson: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const toggleFeatureFlagSchema = z.object({
  flagId: zodId,
}).strict();

export const deleteFeatureFlagSchema = z.object({
  flagId: zodId,
}).strict();

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
