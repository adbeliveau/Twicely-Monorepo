import { cache } from 'react';
import { db } from '@twicely/db';
import { category, listing } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { CategoryData } from '@/types/listings';

/**
 * Get all top-level categories with their children and listing counts.
 */
export async function getCategoryTree(): Promise<CategoryData[]> {
  // Run both queries in parallel (independent)
  const [allCategories, listingCounts] = await Promise.all([
    db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
      })
      .from(category)
      .where(eq(category.isActive, true)),
    db
      .select({
        categoryId: listing.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE'))
      .groupBy(listing.categoryId),
  ]);

  const countMap = new Map(
    listingCounts.map((c) => [c.categoryId, c.count])
  );

  // Build tree structure
  const categoryMap = new Map<string, CategoryData>();
  const topLevel: CategoryData[] = [];

  // First pass: create all category objects
  for (const cat of allCategories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId,
      children: [],
    });
  }

  // Second pass: build parent-child relationships
  for (const cat of allCategories) {
    const categoryData = categoryMap.get(cat.id)!;
    if (cat.parentId === null) {
      topLevel.push(categoryData);
    } else {
      const parent = categoryMap.get(cat.parentId);
      if (parent && parent.children) {
        parent.children.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          listingCount: countMap.get(cat.id) ?? 0,
        });
      }
    }
  }

  return topLevel;
}

/**
 * Get a single category by slug with children and listing counts.
 */
export const getCategoryBySlug = cache(async function getCategoryBySlug(
  slug: string
): Promise<CategoryData | null> {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
    })
    .from(category)
    .where(and(eq(category.slug, slug), eq(category.isActive, true)))
    .limit(1);

  const cat = rows[0];
  if (!cat) return null;

  // Get children and listing counts in parallel (independent)
  const [children, listingCounts] = await Promise.all([
    db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })
      .from(category)
      .where(and(eq(category.parentId, cat.id), eq(category.isActive, true))),
    db
      .select({
        categoryId: listing.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE'))
      .groupBy(listing.categoryId),
  ]);

  const countMap = new Map(
    listingCounts
      .filter((c) => c.categoryId !== null)
      .map((c) => [c.categoryId!, c.count])
  );

  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parentId: cat.parentId,
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      listingCount: countMap.get(c.id) ?? 0,
    })),
  };
});

/**
 * Get a subcategory by parent slug + own slug.
 */
export async function getSubcategory(
  parentSlug: string,
  childSlug: string
): Promise<CategoryData | null> {
  // First find the parent
  const parentRows = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.slug, parentSlug), eq(category.isActive, true)))
    .limit(1);

  const parent = parentRows[0];
  if (!parent) return null;

  // Then find the child
  const childRows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
    })
    .from(category)
    .where(
      and(
        eq(category.slug, childSlug),
        eq(category.parentId, parent.id),
        eq(category.isActive, true)
      )
    )
    .limit(1);

  const child = childRows[0];
  if (!child) return null;

  // Get siblings (other children of same parent) for navigation
  const siblings = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })
    .from(category)
    .where(and(eq(category.parentId, parent.id), eq(category.isActive, true)));

  // Get listing counts for siblings
  const siblingIds = siblings.map((s) => s.id);
  let countMap = new Map<string, number>();

  if (siblingIds.length > 0) {
    const listingCounts = await db
      .select({
        categoryId: listing.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE'))
      .groupBy(listing.categoryId);

    countMap = new Map(
      listingCounts
        .filter((c) => c.categoryId !== null)
        .map((c) => [c.categoryId!, c.count])
    );
  }

  return {
    id: child.id,
    name: child.name,
    slug: child.slug,
    description: child.description,
    parentId: child.parentId,
    children: siblings.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      listingCount: countMap.get(s.id) ?? 0,
    })),
  };
}

/**
 * Get category by ID (for resolving categoryId from URL params)
 */
export async function getCategoryById(id: string): Promise<CategoryData | null> {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
    })
    .from(category)
    .where(and(eq(category.id, id), eq(category.isActive, true)))
    .limit(1);

  const cat = rows[0];
  if (!cat) return null;

  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parentId: cat.parentId,
  };
}
