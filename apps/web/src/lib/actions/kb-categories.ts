'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { kbArticle, kbCategory } from '@twicely/db/schema';
import { eq, count } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  createKbCategorySchema,
  updateKbCategorySchema,
} from '@/lib/validations/helpdesk';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── KB Categories ────────────────────────────────────────────────────────────

export async function createKbCategory(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbCategory')) {
    return { success: false, error: 'Access denied. HELPDESK_LEAD role required.' };
  }

  const parsed = createKbCategorySchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const d = parsed.data;

  const catRows = await db.insert(kbCategory).values({
    slug: d.slug,
    parentId: d.parentId ?? null,
    name: d.name,
    description: d.description ?? null,
    icon: d.icon ?? null,
    sortOrder: d.sortOrder ?? 0,
  }).returning({ id: kbCategory.id });

  const catRow = catRows[0];
  if (!catRow) return { success: false, error: 'Insert failed' };
  revalidatePath('/kb/categories');
  revalidatePath('/h');
  return { success: true, data: { id: catRow.id } };
}

export async function updateKbCategory(
  formData: unknown
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbCategory')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = updateKbCategorySchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { categoryId, ...fields } = parsed.data;

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.slug !== undefined) updateFields.slug = fields.slug;
  if (fields.parentId !== undefined) updateFields.parentId = fields.parentId;
  if (fields.name !== undefined) updateFields.name = fields.name;
  if (fields.description !== undefined) updateFields.description = fields.description;
  if (fields.icon !== undefined) updateFields.icon = fields.icon;
  if (fields.sortOrder !== undefined) updateFields.sortOrder = fields.sortOrder;
  if (fields.isActive !== undefined) updateFields.isActive = fields.isActive;

  await db.update(kbCategory)
    .set(updateFields)
    .where(eq(kbCategory.id, categoryId));

  revalidatePath('/kb/categories');
  revalidatePath('/h');
  return { success: true };
}

export async function deleteKbCategory(
  categoryId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbCategory')) {
    return { success: false, error: 'Access denied' };
  }

  // Check category exists
  const existing = await db
    .select({ id: kbCategory.id })
    .from(kbCategory)
    .where(eq(kbCategory.id, categoryId))
    .limit(1);
  if (!existing[0]) return { success: false, error: 'Not found' };

  // Check for articles in this category
  const articleCounts = await db
    .select({ cnt: count(kbArticle.id) })
    .from(kbArticle)
    .where(eq(kbArticle.categoryId, categoryId));

  const articleCount = Number(articleCounts[0]?.cnt ?? 0);
  if (articleCount > 0) {
    return {
      success: false,
      error: 'Cannot delete category with existing articles. Move or delete articles first.',
    };
  }

  await db.delete(kbCategory).where(eq(kbCategory.id, categoryId));

  revalidatePath('/kb/categories');
  revalidatePath('/h');
  return { success: true };
}

export async function reorderKbCategories(
  orderedIds: string[]
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'KbCategory')) {
    return { success: false, error: 'Access denied' };
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(kbCategory)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(kbCategory.id, id))
    )
  );

  revalidatePath('/kb/categories');
  revalidatePath('/h');
  return { success: true };
}
