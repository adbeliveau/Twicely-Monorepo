/**
 * Minimal type file for ShippingAddressJson.
 * Extracted from apps/web/src/lib/validations/address.ts
 */
import { z } from 'zod';

/**
 * Zod schema for shipping address JSON stored on orders.
 */
export const shippingAddressJsonSchema = z.object({
  name: z.string(),
  address1: z.string(),
  address2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
}).strict();

export type ShippingAddressJson = z.infer<typeof shippingAddressJsonSchema>;
