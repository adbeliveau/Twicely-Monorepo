/**
 * Zod runtime validation schema for Mercari item data.
 * Validates fields accessed by normalizeMercariListing() in mercari-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const MercariPhotoSchema = z.object({
  url: z.string(),
});

const MercariBrandSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});

const MercariCategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});

const MercariShippingSchema = z.object({
  method_id: z.number().optional(),
  payer_id: z.number().optional(),
  fee: z.number().optional(),
});

export const MercariItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  status: z.string().optional(),
  condition_id: z.number().optional(),
  photos: z.array(MercariPhotoSchema).optional(),
  brand: MercariBrandSchema.optional(),
  categories: z.array(MercariCategorySchema).optional(),
  shipping: MercariShippingSchema.optional(),
  created: z.number().optional(),
});

export type { MercariItem } from '@twicely/crosslister/connectors/mercari-types';
