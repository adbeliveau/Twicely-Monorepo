/**
 * Zod runtime validation schema for The RealReal consignment data.
 * Validates fields accessed by normalizeTrrListing() in therealreal-normalizer.ts.
 * Source: F2/F3 install prompts — schema validation layer.
 */

import { z } from 'zod';

const TrrDesignerSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
});

const TrrCategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
});

const TrrImageSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  position: z.number(),
  is_primary: z.boolean().optional(),
});

export const TrrConsignmentSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  condition: z.string().optional(),
  authentication_status: z.string().optional(),
  status: z.string().optional(),
  designer: TrrDesignerSchema.optional(),
  category: TrrCategorySchema.optional(),
  images: z.array(TrrImageSchema).optional(),
  created_at: z.string().optional(),
  sold_at: z.string().optional(),
  size: z.string().optional(),
  condition_notes: z.string().optional(),
});

export type { TrrConsignment } from './therealreal-types';
