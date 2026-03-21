/**
 * Zod runtime validation schema for Poshmark listing data.
 * Validates fields accessed by normalizePoshmarkListing() in poshmark-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const PoshmarkPriceAmountSchema = z.object({
  val: z.string().optional(),
  currency_code: z.string().optional(),
});

const PoshmarkSizeQuantitySchema = z.object({
  size_id: z.string().optional(),
  quantity_available: z.number().optional(),
});

const PoshmarkPictureSchema = z.object({
  url: z.string(),
});

const PoshmarkCovershotSchema = z.object({
  url: z.string(),
});

const PoshmarkCatalogSchema = z.object({
  department_obj: z.object({ display: z.string().optional() }).optional(),
  category_obj: z.object({ display: z.string().optional() }).optional(),
});

const PoshmarkBrandSchema = z.object({
  display: z.string().optional(),
});

export const PoshmarkListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  price_amount: PoshmarkPriceAmountSchema.optional(),
  inventory: z.object({
    size_quantities: z.array(PoshmarkSizeQuantitySchema).optional(),
  }).optional(),
  catalog: PoshmarkCatalogSchema.optional(),
  pictures: z.array(PoshmarkPictureSchema).optional(),
  brand: PoshmarkBrandSchema.optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
  covershot: PoshmarkCovershotSchema.optional(),
});

export type { PoshmarkListing } from './poshmark-types';
