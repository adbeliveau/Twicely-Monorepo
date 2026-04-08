'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { category, listing } from '@twicely/db/schema';
import { eq, and, count, like } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from '@/lib/validations/admin-categories';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

function computeDepthAndPath(
  parent: { depth: number; path: string } | null,
  slug: string
): { depth: number; path: string } {
  if (parent) {
    return {
      depth: parent.depth + 1,
      path: parent.path ? `${parent.path}.${slug}` : slug,
    };
  }
  return { depth: 0, path: slug };
}

// ─── Category CRUD ─────────────────────────────────────────────────────────────

export async function createCategory(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied. ADMIN role required.' };
  }

  const parsed = createCategorySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const d = parsed.data;
  let parent: { depth: number; path: string; isLeaf: boolean; id: string } | null = null;

  if (d.parentId) {
    const parentRows = await db.select({
      id: category.id,
      depth: category.depth,
      path: category.path,
      isLeaf: category.isLeaf,
    }).from(category).where(eq(category.id, d.parentId)).limit(1);

    parent = parentRows[0] ?? null;
    if (!parent) return { success: false, error: 'Parent category not found.' };
  }

  const { depth, path } = computeDepthAndPath(parent, d.slug);

  const inserted = await db.insert(category).values({
    name: d.name,
    slug: d.slug,
    parentId: d.parentId ?? null,
    description: d.description ?? null,
    icon: d.icon ?? null,
    feeBucket: d.feeBucket,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    isLeaf: d.isLeaf,
    depth,
    path,
    metaTitle: d.metaTitle ?? null,
    metaDescription: d.metaDescription ?? null,
  }).returning({ id: category.id });

  const newCat = inserted[0];
  if (!newCat) return { success: false, error: 'Insert failed.' };

  if (parent?.isLeaf) {
    await db.update(category)
      .set({ isLeaf: false, updatedAt: new Date() })
      .where(eq(category.id, parent.id));
  }

  revalidatePath('/categories');
  return { success: true, data: { id: newCat.id } };
}

export async function updateCategory(
  formData: unknown
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const parsed = updateCategorySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, ...fields } = parsed.data;

  const existing = await db.select({
    id: category.id,
    path: category.path,
    depth: category.depth,
    parentId: category.parentId,
    slug: category.slug,
  }).from(category).where(eq(category.id, id)).limit(1);

  const cat = existing[0];
  if (!cat) return { success: false, error: 'Not found.' };

  if (fields.parentId !== undefined && fields.parentId !== cat.parentId) {
    const newParentId = fields.parentId;

    if (newParentId === id) {
      return { success: false, error: 'A category cannot be its own parent.' };
    }

    if (newParentId !== null) {
      const proposedParentRows = await db.select({
        id: category.id,
        path: category.path,
        depth: category.depth,
      }).from(category).where(eq(category.id, newParentId)).limit(1);

      const proposedParent = proposedParentRows[0];
      if (!proposedParent) return { success: false, error: 'New parent category not found.' };

      if (proposedParent.path.startsWith(cat.path + '.')) {
        return { success: false, error: 'Cannot set a descendant as parent (circular reference).' };
      }

      const newSlug = fields.slug ?? cat.slug;
      const newDepth = proposedParent.depth + 1;
      const newPath = proposedParent.path
        ? `${proposedParent.path}.${newSlug}`
        : newSlug;

      const oldPath = cat.path;

      await db.update(category).set({
        parentId: newParentId,
        depth: newDepth,
        path: newPath,
        updatedAt: new Date(),
      }).where(eq(category.id, id));

      const descendants = await db.select({
        id: category.id,
        path: category.path,
        depth: category.depth,
      }).from(category).where(like(category.path, `${oldPath}.%`));

      for (const desc of descendants) {
        const descNewPath = newPath + desc.path.slice(oldPath.length);
        const depthDiff = newDepth - cat.depth;
        await db.update(category).set({
          path: descNewPath,
          depth: desc.depth + depthDiff,
          updatedAt: new Date(),
        }).where(eq(category.id, desc.id));
      }

      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) updateFields.name = fields.name;
      if (fields.slug !== undefined) updateFields.slug = fields.slug;
      if (fields.description !== undefined) updateFields.description = fields.description;
      if (fields.icon !== undefined) updateFields.icon = fields.icon;
      if (fields.feeBucket !== undefined) updateFields.feeBucket = fields.feeBucket;
      if (fields.sortOrder !== undefined) updateFields.sortOrder = fields.sortOrder;
      if (fields.isActive !== undefined) updateFields.isActive = fields.isActive;
      if (fields.isLeaf !== undefined) updateFields.isLeaf = fields.isLeaf;
      if (fields.metaTitle !== undefined) updateFields.metaTitle = fields.metaTitle;
      if (fields.metaDescription !== undefined) updateFields.metaDescription = fields.metaDescription;

      await db.update(category).set(updateFields).where(eq(category.id, id));
      revalidatePath('/categories');
      return { success: true };
    }
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updateFields.name = fields.name;
  if (fields.slug !== undefined) updateFields.slug = fields.slug;
  if (fields.parentId !== undefined) updateFields.parentId = fields.parentId;
  if (fields.description !== undefined) updateFields.description = fields.description;
  if (fields.icon !== undefined) updateFields.icon = fields.icon;
  if (fields.feeBucket !== undefined) updateFields.feeBucket = fields.feeBucket;
  if (fields.sortOrder !== undefined) updateFields.sortOrder = fields.sortOrder;
  if (fields.isActive !== undefined) updateFields.isActive = fields.isActive;
  if (fields.isLeaf !== undefined) updateFields.isLeaf = fields.isLeaf;
  if (fields.metaTitle !== undefined) updateFields.metaTitle = fields.metaTitle;
  if (fields.metaDescription !== undefined) updateFields.metaDescription = fields.metaDescription;

  await db.update(category).set(updateFields).where(eq(category.id, id));
  revalidatePath('/categories');
  return { success: true };
}

export async function deleteCategory(
  categoryId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const existing = await db.select({ id: category.id })
    .from(category).where(eq(category.id, categoryId)).limit(1);
  if (!existing[0]) return { success: false, error: 'Not found.' };

  const [listingResult] = await db.select({ cnt: count() }).from(listing)
    .where(and(eq(listing.categoryId, categoryId), eq(listing.status, 'ACTIVE')));
  const listingCount = listingResult?.cnt ?? 0;
  if (listingCount > 0) {
    return { success: false, error: `Cannot deactivate: ${listingCount} active listing(s) in this category.` };
  }

  const [childResult] = await db.select({ cnt: count() }).from(category)
    .where(and(eq(category.parentId, categoryId), eq(category.isActive, true)));
  const childCount = childResult?.cnt ?? 0;
  if (childCount > 0) {
    return { success: false, error: `Cannot deactivate: ${childCount} active subcategory(ies) exist.` };
  }

  await db.update(category)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(category.id, categoryId));

  revalidatePath('/categories');
  return { success: true };
}

export async function reorderCategories(
  data: unknown
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'Category')) {
    return { success: false, error: 'Access denied.' };
  }

  const parsed = reorderCategoriesSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        tx.update(category)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(category.id, id))
      )
    );
  });

  revalidatePath('/categories');
  return { success: true };
}

// ─── Re-exports from admin-categories-attrs.ts (split) ────────────────────
export {
  createAttributeSchema,
  updateAttributeSchema,
  deleteAttributeSchema,
} from './admin-categories-attrs';
