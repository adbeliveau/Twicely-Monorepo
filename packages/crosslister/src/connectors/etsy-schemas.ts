/**
 * Zod runtime validation schema for Etsy listing data.
 * Validates fields accessed by normalizeEtsyListing() in etsy-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const EtsyMoneySchema = z.object({
  amount: z.number().optional(),
  divisor: z.number().optional(),
  currency_code: z.string().optional(),
});

const EtsyListingImageSchema = z.object({
  listing_image_id: z.number().optional(),
  url_fullxfull: z.string(),
  rank: z.number(),
  is_watermarked: z.boolean().optional(),
});

export const EtsyListingSchema = z.object({
  listing_id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  state: z.string().optional(),
  quantity: z.number().optional(),
  url: z.string().optional(),
  creation_timestamp: z.number().optional(),
  price: EtsyMoneySchema.optional(),
  images: z.array(EtsyListingImageSchema).optional(),
  taxonomy_path: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  who_made: z.string().optional(),
  when_made: z.string().optional(),
});

export type { EtsyListing } from './etsy-types';
