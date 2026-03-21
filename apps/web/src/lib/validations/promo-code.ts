import { z } from 'zod';

const codeField = z
  .string()
  .min(4, 'Code must be at least 4 characters')
  .max(20, 'Code must be at most 20 characters')
  .regex(/^[A-Z0-9-]+$/, 'Only uppercase letters, numbers, and hyphens')
  .transform((val) => val.toUpperCase());

const adminCodeField = z
  .string()
  .min(4)
  .max(20)
  .regex(/^[A-Z0-9-]+$/)
  .transform((val) => val.toUpperCase());

export const createPromoCodeSchema = z
  .object({
    code: codeField,
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().int().positive('Discount must be positive'),
    durationMonths: z.number().int().min(1).max(12).default(1),
    scopeProductTypes: z
      .array(z.enum(['store', 'lister', 'automation', 'finance']))
      .optional(),
    usageLimit: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export const updatePromoCodeSchema = z
  .object({
    id: z.string().min(1),
    isActive: z.boolean().optional(),
    usageLimit: z.number().int().positive().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export const createPlatformPromoCodeSchema = z
  .object({
    code: adminCodeField,
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().int().positive(),
    durationMonths: z.number().int().min(1).max(12).default(1),
    scopeProductTypes: z
      .array(z.enum(['store', 'lister', 'automation', 'finance']))
      .optional(),
    usageLimit: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export const applyPromoCodeSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(20)
      .transform((val) => val.toUpperCase()),
    product: z.enum(['store', 'lister', 'automation', 'finance', 'bundle']),
  })
  .strict();

export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type UpdatePromoCodeInput = z.infer<typeof updatePromoCodeSchema>;
export type CreatePlatformPromoCodeInput = z.infer<typeof createPlatformPromoCodeSchema>;
export type ApplyPromoCodeInput = z.infer<typeof applyPromoCodeSchema>;
