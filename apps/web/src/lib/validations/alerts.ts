import { z } from 'zod';

const PRICE_ALERT_TYPES = ['ANY_DROP', 'TARGET_PRICE', 'PERCENT_DROP', 'BACK_IN_STOCK'] as const;

export const createPriceAlertSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
  alertType: z.enum(PRICE_ALERT_TYPES),
  targetPriceCents: z.number().int().positive().optional(),
  targetPercentDrop: z.number().min(5).max(50).optional(),
}).strict();

export type CreatePriceAlertInput = z.infer<typeof createPriceAlertSchema>;

export const deletePriceAlertSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
}).strict();

export type DeletePriceAlertInput = z.infer<typeof deletePriceAlertSchema>;

export const saveCategoryAlertSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  categoryName: z.string().min(1, 'Category name is required'),
  condition: z.array(z.string()).optional(),
  minPriceCents: z.number().int().min(0).optional(),
  maxPriceCents: z.number().int().min(0).optional(),
}).strict();

export type SaveCategoryAlertInput = z.infer<typeof saveCategoryAlertSchema>;

export const deleteCategoryAlertSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
}).strict();

export type DeleteCategoryAlertInput = z.infer<typeof deleteCategoryAlertSchema>;
