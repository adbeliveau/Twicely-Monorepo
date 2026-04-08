'use server';

/**
 * Admin Category Attribute Schema Actions
 * Split from admin-categories.ts for file-size compliance.
 * CRUD for categoryAttributeSchema records.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { categoryAttributeSchema } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  createAttributeSchemaInput,
  updateAttributeSchemaInput,
} from '@/lib/validations/admin-categories';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function createAttributeSchema(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const parsed = createAttributeSchemaInput.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const d = parsed.data;

  const inserted = await db.insert(categoryAttributeSchema).values({
    categoryId: d.categoryId,
    name: d.name,
    label: d.label,
    fieldType: d.fieldType,
    isRequired: d.isRequired,
    isRecommended: d.isRecommended,
    showInFilters: d.showInFilters,
    showInListing: d.showInListing,
    optionsJson: d.optionsJson,
    validationJson: d.validationJson,
    sortOrder: d.sortOrder,
  }).returning({ id: categoryAttributeSchema.id });

  const row = inserted[0];
  if (!row) return { success: false, error: 'Insert failed.' };

  revalidatePath('/categories');
  return { success: true, data: { id: row.id } };
}

export async function updateAttributeSchema(
  formData: unknown
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const parsed = updateAttributeSchemaInput.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, ...fields } = parsed.data;

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updateFields.name = fields.name;
  if (fields.label !== undefined) updateFields.label = fields.label;
  if (fields.fieldType !== undefined) updateFields.fieldType = fields.fieldType;
  if (fields.isRequired !== undefined) updateFields.isRequired = fields.isRequired;
  if (fields.isRecommended !== undefined) updateFields.isRecommended = fields.isRecommended;
  if (fields.showInFilters !== undefined) updateFields.showInFilters = fields.showInFilters;
  if (fields.showInListing !== undefined) updateFields.showInListing = fields.showInListing;
  if (fields.optionsJson !== undefined) updateFields.optionsJson = fields.optionsJson;
  if (fields.validationJson !== undefined) updateFields.validationJson = fields.validationJson;
  if (fields.sortOrder !== undefined) updateFields.sortOrder = fields.sortOrder;

  await db.update(categoryAttributeSchema)
    .set(updateFields)
    .where(eq(categoryAttributeSchema.id, id));

  revalidatePath('/categories');
  return { success: true };
}

export async function deleteAttributeSchema(
  id: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const existing = await db.select({ id: categoryAttributeSchema.id })
    .from(categoryAttributeSchema)
    .where(eq(categoryAttributeSchema.id, id))
    .limit(1);
  if (!existing[0]) return { success: false, error: 'Not found.' };

  await db.delete(categoryAttributeSchema)
    .where(eq(categoryAttributeSchema.id, id));

  revalidatePath('/categories');
  return { success: true };
}
