/**
 * Zod runtime validation schema for Depop product data.
 * Validates fields accessed by normalizeDepopListing() in depop-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const DepopPriceSchema = z.object({
  price_amount: z.string().optional(),
  currency_name: z.string().optional(),
});

const DepopImageSchema = z.object({
  id: z.number().optional(),
  url: z.string(),
});

const DepopCategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});

const DepopBrandSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});

export const DepopProductSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  price: DepopPriceSchema.optional(),
  status: z.string().optional(),
  condition: z.string().optional(),
  category: DepopCategorySchema.optional(),
  brand: DepopBrandSchema.optional(),
  pictures: z.array(DepopImageSchema).optional(),
  preview_pictures: z.array(DepopImageSchema).optional(),
  url: z.string().optional(),
  created_at: z.string().optional(),
  sold_at: z.string().optional(),
  size: z.string().optional(),
  color1: z.string().optional(),
  color2: z.string().optional(),
  national_shipping_cost: z.string().optional(),
});

export type { DepopProduct } from './depop-types';
