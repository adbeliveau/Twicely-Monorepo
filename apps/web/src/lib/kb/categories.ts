/**
 * KB Category Service
 *
 * Manages hierarchical KB categories with CRUD operations,
 * tree structure retrieval, and reordering support.
 */

import { db } from '@twicely/db';
import { kbCategoryV2 } from '@twicely/db/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { KbCategoryInput, CategoryTreeNode } from './types';

/**
 * Creates a new KB category.
 */
export async function createCategory(input: KbCategoryInput): Promise<{ id: string }> {
  const id = createId();
  const now = new Date();

  await db.insert(kbCategoryV2).values({
    id,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
    position: input.position ?? 0,
    iconName: input.iconName ?? null,
    isPublic: input.isPublic ?? true,
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

/**
 * Updates an existing KB category.
 */
export async function updateCategory(
  id: string,
  input: Partial<KbCategoryInput>,
): Promise<{ updated: boolean }> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.description !== undefined) updates.description = input.description;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.position !== undefined) updates.position = input.position;
  if (input.iconName !== undefined) updates.iconName = input.iconName;
  if (input.isPublic !== undefined) updates.isPublic = input.isPublic;

  const result = await db
    .update(kbCategoryV2)
    .set(updates)
    .where(eq(kbCategoryV2.id, id))
    .returning({ id: kbCategoryV2.id });

  return { updated: result.length > 0 };
}

/**
 * Deletes a KB category. Articles in this category become uncategorized.
 */
export async function deleteCategory(id: string): Promise<{ deleted: boolean }> {
  const result = await db
    .delete(kbCategoryV2)
    .where(eq(kbCategoryV2.id, id))
    .returning({ id: kbCategoryV2.id });

  return { deleted: result.length > 0 };
}

/**
 * Returns all KB categories as a flat list, ordered by position.
 */
export async function getCategories(): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  iconName: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}>> {
  return db
    .select()
    .from(kbCategoryV2)
    .orderBy(asc(kbCategoryV2.position));
}

/**
 * Builds a nested tree structure from the flat category list.
 * Root categories (parentId = null) are top-level nodes.
 */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const categories = await getCategories();

  const nodeMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // First pass: create all nodes
  for (const cat of categories) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId,
      position: cat.position,
      iconName: cat.iconName,
      isPublic: cat.isPublic,
      children: [],
    });
  }

  // Second pass: build tree
  for (const cat of categories) {
    const node = nodeMap.get(cat.id);
    if (!node) continue;

    if (cat.parentId && nodeMap.has(cat.parentId)) {
      const parent = nodeMap.get(cat.parentId);
      if (parent) {
        // Cast to mutable to build tree, the result is still readonly at the type level
        (parent.children as CategoryTreeNode[]).push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Reorders categories within a parent. Updates position values
 * based on the order of IDs provided.
 */
export async function reorderCategories(
  parentId: string | null,
  orderedIds: string[],
): Promise<void> {
  // Update each category's position, scoped to the given parent for safety
  const now = new Date();
  const updates = orderedIds.map((id, index) =>
    db
      .update(kbCategoryV2)
      .set({ position: index, updatedAt: now })
      .where(
        parentId
          ? and(eq(kbCategoryV2.id, id), eq(kbCategoryV2.parentId, parentId))
          : and(eq(kbCategoryV2.id, id), isNull(kbCategoryV2.parentId)),
      ),
  );

  await Promise.all(updates);
}
