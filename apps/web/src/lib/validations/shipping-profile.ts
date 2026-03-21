import { z } from 'zod';

// Combined shipping mode enum values
export const COMBINED_SHIPPING_MODES = ['NONE', 'FLAT', 'PER_ADDITIONAL', 'AUTO_DISCOUNT', 'QUOTED'] as const;
export type CombinedShippingMode = typeof COMBINED_SHIPPING_MODES[number];

// Carrier options
export const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'] as const;
export type Carrier = typeof CARRIERS[number];

// Base shipping profile schema
const baseShippingProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  carrier: z.enum(CARRIERS),
  service: z.string().optional(),
  handlingTimeDays: z.number().int().min(1).max(10),
  isDefault: z.boolean().default(false),
  weightOz: z.number().int().min(1).max(1200).optional(),
  lengthIn: z.number().min(0.1).max(108).optional(),
  widthIn: z.number().min(0.1).max(108).optional(),
  heightIn: z.number().min(0.1).max(108).optional(),
});

// Create shipping profile input
export const createShippingProfileSchema = z.discriminatedUnion('combinedShippingMode', [
  // NONE mode (individual shipping, default)
  z.object({
    ...baseShippingProfileSchema.shape,
    combinedShippingMode: z.literal('NONE'),
  }),

  // FLAT mode (flat fee for any bundle)
  z.object({
    ...baseShippingProfileSchema.shape,
    combinedShippingMode: z.literal('FLAT'),
    flatCombinedCents: z.number().int().min(1).max(99999),
  }),

  // PER_ADDITIONAL mode (+$X per extra item)
  z.object({
    ...baseShippingProfileSchema.shape,
    combinedShippingMode: z.literal('PER_ADDITIONAL'),
    additionalItemCents: z.number().int().min(1).max(99999),
  }),

  // AUTO_DISCOUNT mode (X% off total shipping)
  z.object({
    ...baseShippingProfileSchema.shape,
    combinedShippingMode: z.literal('AUTO_DISCOUNT'),
    autoDiscountPercent: z.number().min(10).max(75),
    autoDiscountMinItems: z.number().int().min(2).max(20).default(2),
  }),

  // QUOTED mode (seller quotes after order, no extra fields)
  z.object({
    ...baseShippingProfileSchema.shape,
    combinedShippingMode: z.literal('QUOTED'),
  }),
]);

export type CreateShippingProfileInput = z.infer<typeof createShippingProfileSchema>;

// Update shipping profile input
export const updateShippingProfileSchema = z.object({
  id: z.string().cuid2(),
  name: z.string().min(1).max(50).optional(),
  carrier: z.enum(CARRIERS).optional(),
  service: z.string().optional(),
  handlingTimeDays: z.number().int().min(1).max(10).optional(),
  isDefault: z.boolean().optional(),
  weightOz: z.number().int().min(1).max(1200).optional().nullable(),
  lengthIn: z.number().min(0.1).max(108).optional().nullable(),
  widthIn: z.number().min(0.1).max(108).optional().nullable(),
  heightIn: z.number().min(0.1).max(108).optional().nullable(),
  combinedShippingMode: z.enum(COMBINED_SHIPPING_MODES).optional(),
  flatCombinedCents: z.number().int().min(1).max(99999).optional().nullable(),
  additionalItemCents: z.number().int().min(1).max(99999).optional().nullable(),
  autoDiscountPercent: z.number().min(10).max(75).optional().nullable(),
  autoDiscountMinItems: z.number().int().min(2).max(20).optional().nullable(),
}).strict();

export type UpdateShippingProfileInput = z.infer<typeof updateShippingProfileSchema>;

// Set default shipping profile input
export const setDefaultShippingProfileSchema = z.object({
  id: z.string().cuid2(),
}).strict();

export type SetDefaultShippingProfileInput = z.infer<typeof setDefaultShippingProfileSchema>;

// Delete shipping profile input
export const deleteShippingProfileSchema = z.object({
  id: z.string().cuid2(),
}).strict();

export type DeleteShippingProfileInput = z.infer<typeof deleteShippingProfileSchema>;
