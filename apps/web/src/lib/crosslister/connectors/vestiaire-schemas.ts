/**
 * Zod runtime validation schema for Vestiaire Collective listing data.
 * Validates fields accessed by normalizeVestiaireListing() in vestiaire-normalizer.ts.
 * Source: H4.2 install prompt — VESTIAIRE schema validation layer.
 */

import { z } from 'zod';

const VestiaireBrandSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
});

const VestiaireCategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
});

const VestiaireImageSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  position: z.number(),
  is_primary: z.boolean().optional(),
});

export const VestiaireListingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  brand: VestiaireBrandSchema.optional(),
  category: VestiaireCategorySchema.optional(),
  images: z.array(VestiaireImageSchema).optional(),
  created_at: z.string().optional(),
  sold_at: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  slug: z.string().optional(),
});

export type { VestiaireListing } from '@twicely/crosslister/connectors/vestiaire-types';
