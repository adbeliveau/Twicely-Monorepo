import { z } from 'zod';
import { zodId } from '@/lib/validation/schemas';

// Dotted key format: category.subcategory.name (1-3 segments)
function isFlagKey(value: string): boolean {
  const segments = value.split('.');
  if (segments.length === 0 || segments.length > 3) return false;

  return segments.every((segment) => {
    if (segment.length === 0) return false;
    const [first, ...rest] = segment;
    if (!first || first < 'a' || first > 'z') return false;
    return rest.every((char) => (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9'));
  });
}

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).refine(isFlagKey, 'Key must be dotted lowercase (e.g. feature.newCheckout)'),
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
