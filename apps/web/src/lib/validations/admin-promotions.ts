import { z } from 'zod';

export const adminPromotionIdSchema = z.object({
  promotionId: z.string().min(1),
}).strict();

export const adminPromotionsFilterSchema = z.object({
  status: z.enum(['active', 'scheduled', 'ended', 'all']).optional(),
  sellerId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
}).strict();

export const adminPromoCodesFilterSchema = z.object({
  type: z.enum(['AFFILIATE', 'PLATFORM']).optional(),
  search: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
}).strict();
