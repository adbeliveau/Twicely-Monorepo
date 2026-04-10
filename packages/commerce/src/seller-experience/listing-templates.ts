import { db } from '@twicely/db';
import { listingTemplate } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { TemplateInput } from './types';

interface TemplateRow {
  id: string;
  sellerId: string;
  name: string;
  categoryId: string | null;
  descriptionTemplate: string | null;
  conditionDefault: string | null;
  shippingPresetId: string | null;
  defaultsJson: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new listing template for a seller.
 */
export async function createTemplate(
  sellerId: string,
  input: TemplateInput
): Promise<{ id: string }> {
  const id = createId();
  await db.insert(listingTemplate).values({
    id,
    sellerId,
    name: input.name,
    categoryId: input.categoryId ?? null,
    descriptionTemplate: input.descriptionTemplate ?? null,
    conditionDefault: input.conditionDefault ?? null,
    shippingPresetId: input.shippingPresetId ?? null,
    defaultsJson: input.defaultsJson ?? {},
    isActive: true,
  });
  return { id };
}

/**
 * Update an existing listing template.
 */
export async function updateTemplate(
  id: string,
  input: Partial<TemplateInput>
): Promise<void> {
  await db
    .update(listingTemplate)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.descriptionTemplate !== undefined && { descriptionTemplate: input.descriptionTemplate }),
      ...(input.conditionDefault !== undefined && { conditionDefault: input.conditionDefault }),
      ...(input.shippingPresetId !== undefined && { shippingPresetId: input.shippingPresetId }),
      ...(input.defaultsJson !== undefined && { defaultsJson: input.defaultsJson }),
      updatedAt: new Date(),
    })
    .where(eq(listingTemplate.id, id));
}

/**
 * Delete (deactivate) a listing template.
 */
export async function deleteTemplate(id: string): Promise<void> {
  await db
    .update(listingTemplate)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(listingTemplate.id, id));
}

/**
 * Get all active templates for a seller.
 */
export async function getTemplates(sellerId: string): Promise<TemplateRow[]> {
  const rows = await db
    .select({
      id: listingTemplate.id,
      sellerId: listingTemplate.sellerId,
      name: listingTemplate.name,
      categoryId: listingTemplate.categoryId,
      descriptionTemplate: listingTemplate.descriptionTemplate,
      conditionDefault: listingTemplate.conditionDefault,
      shippingPresetId: listingTemplate.shippingPresetId,
      defaultsJson: listingTemplate.defaultsJson,
      isActive: listingTemplate.isActive,
      createdAt: listingTemplate.createdAt,
      updatedAt: listingTemplate.updatedAt,
    })
    .from(listingTemplate)
    .where(
      and(
        eq(listingTemplate.sellerId, sellerId),
        eq(listingTemplate.isActive, true)
      )
    )
    .orderBy(desc(listingTemplate.createdAt));

  return rows as unknown as TemplateRow[];
}

/**
 * Apply a template's defaults to a listing input.
 * Merges template defaults with provided listing input (listing input takes priority).
 */
export async function applyTemplate(
  templateId: string,
  listingInput: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const [template] = await db
    .select({
      categoryId: listingTemplate.categoryId,
      descriptionTemplate: listingTemplate.descriptionTemplate,
      conditionDefault: listingTemplate.conditionDefault,
      shippingPresetId: listingTemplate.shippingPresetId,
      defaultsJson: listingTemplate.defaultsJson,
    })
    .from(listingTemplate)
    .where(eq(listingTemplate.id, templateId))
    .limit(1);

  if (!template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }

  const defaults: Record<string, unknown> = {
    ...(typeof template.defaultsJson === 'object' && template.defaultsJson !== null
      ? template.defaultsJson as Record<string, unknown>
      : {}),
    ...(template.categoryId && { categoryId: template.categoryId }),
    ...(template.descriptionTemplate && { description: template.descriptionTemplate }),
    ...(template.conditionDefault && { condition: template.conditionDefault }),
    ...(template.shippingPresetId && { shippingPresetId: template.shippingPresetId }),
  };

  // Listing input overrides template defaults
  return { ...defaults, ...listingInput };
}
