import { z } from 'zod';
import { zodId } from './shared';

const feeBucketValues = ['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY'] as const;
const fieldTypeValues = ['text', 'select', 'multi_select', 'number'] as const;

function isSlug(value: string): boolean {
  if (value.length === 0 || value.startsWith('-') || value.endsWith('-') || value.includes('--')) {
    return false;
  }
  return Array.from(value).every(
    (char) => (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-',
  );
}

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).refine(isSlug),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  feeBucket: z.enum(feeBucketValues),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isLeaf: z.boolean().default(false),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
}).strict();

export const updateCategorySchema = z.object({
  id: zodId,
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).refine(isSlug).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  feeBucket: z.enum(feeBucketValues).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isLeaf: z.boolean().optional(),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
}).strict();

export const reorderCategoriesSchema = z.object({
  orderedIds: z.array(zodId).min(1),
}).strict();

export const createAttributeSchemaInput = z.object({
  categoryId: zodId,
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  fieldType: z.enum(fieldTypeValues),
  isRequired: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  showInFilters: z.boolean().default(false),
  showInListing: z.boolean().default(true),
  optionsJson: z.array(z.string()).default([]),
  validationJson: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

export const updateAttributeSchemaInput = z.object({
  id: zodId,
  name: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  fieldType: z.enum(fieldTypeValues).optional(),
  isRequired: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  showInFilters: z.boolean().optional(),
  showInListing: z.boolean().optional(),
  optionsJson: z.array(z.string()).optional(),
  validationJson: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CreateAttributeSchemaInput = z.infer<typeof createAttributeSchemaInput>;
export type UpdateAttributeSchemaInput = z.infer<typeof updateAttributeSchemaInput>;
