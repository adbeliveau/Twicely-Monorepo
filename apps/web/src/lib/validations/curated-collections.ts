import { z } from 'zod';

export const createCollectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

export const updateCollectionSchema = z.object({
  collectionId: z.string().cuid2(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
  isPublished: z.boolean().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const deleteCollectionSchema = z.object({
  collectionId: z.string().cuid2(),
}).strict();

export const addCollectionItemSchema = z.object({
  collectionId: z.string().cuid2(),
  listingId: z.string().cuid2(),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

export const removeCollectionItemSchema = z.object({
  collectionId: z.string().cuid2(),
  listingId: z.string().cuid2(),
}).strict();

export const reorderCollectionItemsSchema = z.object({
  collectionId: z.string().cuid2(),
  items: z.array(z.object({
    listingId: z.string().cuid2(),
    sortOrder: z.number().int().min(0),
  })).min(1),
}).strict();
