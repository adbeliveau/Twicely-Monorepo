/**
 * Zod runtime validation schema for Facebook Commerce listing data.
 * Validates fields accessed by normalizeFbMarketplaceListing() in fb-marketplace-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const FbCommercePriceSchema = z.object({
  amount: z.number().optional(),
  currency: z.string().optional(),
});

const FbCommerceImageSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
});

export const FbCommerceListingSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  price: FbCommercePriceSchema.optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  availability: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  images: z.array(FbCommerceImageSchema).optional(),
  product_item_id: z.string().optional(),
  created_time: z.string().optional(),
  retailer_id: z.string().optional(),
});

export type { FbCommerceListing } from './fb-marketplace-types';
