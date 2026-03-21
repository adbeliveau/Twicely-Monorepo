/**
 * Zod runtime validation schema for Grailed listing data.
 * Validates fields accessed by normalizeGrailedListing() in grailed-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const GrailedDesignerSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
});

const GrailedCategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
});

const GrailedImageSchema = z.object({
  id: z.number().optional(),
  url: z.string(),
  position: z.number(),
});

export const GrailedListingSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  is_new: z.boolean().optional(),
  is_gently_used: z.boolean().optional(),
  is_used: z.boolean().optional(),
  is_very_worn: z.boolean().optional(),
  sold: z.boolean().optional(),
  deleted: z.boolean().optional(),
  designer: GrailedDesignerSchema.optional(),
  designers: z.array(GrailedDesignerSchema).optional(),
  category: GrailedCategorySchema.optional(),
  photos: z.array(GrailedImageSchema).optional(),
  link: z.string().optional(),
  created_at: z.string().optional(),
  size: z.string().optional(),
  size_drop: z.string().optional(),
  location: z.string().optional(),
});

export type { GrailedListing } from './grailed-types';
