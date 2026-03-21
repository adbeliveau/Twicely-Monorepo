import { db } from '@twicely/db';
import { category } from '@twicely/db/schema';
import { eq, ilike, sql, and, isNull } from 'drizzle-orm';

export interface CategorySearchResult {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  isLeaf: boolean;
  depth: number;
}

/**
 * Search categories by name.
 * Returns both leaf and parent categories, sorted by isLeaf DESC, depth DESC.
 * If query is empty, returns top-level categories.
 */
export async function searchCategories(query: string): Promise<CategorySearchResult[]> {
  const trimmedQuery = query.trim();

  // If empty query, return top-level categories
  if (!trimmedQuery) {
    const topLevel = await db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        isLeaf: category.isLeaf,
        depth: category.depth,
      })
      .from(category)
      .where(and(eq(category.isActive, true), isNull(category.parentId)))
      .orderBy(category.sortOrder)
      .limit(20);

    return topLevel.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      parentName: null,
      isLeaf: row.isLeaf,
      depth: row.depth,
    }));
  }

  // Search with ILIKE, join to parent for breadcrumb
  const parent = db
    .select({
      id: category.id,
      name: category.name,
    })
    .from(category)
    .as('parent');

  const results = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      parentName: parent.name,
      isLeaf: category.isLeaf,
      depth: category.depth,
    })
    .from(category)
    .leftJoin(parent, eq(category.parentId, parent.id))
    .where(and(eq(category.isActive, true), ilike(category.name, `%${trimmedQuery}%`)))
    .orderBy(
      sql`${category.isLeaf} DESC`,
      sql`${category.depth} DESC`,
      category.name
    )
    .limit(20);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    parentName: row.parentName,
    isLeaf: row.isLeaf,
    depth: row.depth,
  }));
}

/**
 * Get a category by ID with its parent name.
 */
export async function getCategoryById(id: string): Promise<CategorySearchResult | null> {
  const parent = db
    .select({
      id: category.id,
      name: category.name,
    })
    .from(category)
    .as('parent');

  const results = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      parentName: parent.name,
      isLeaf: category.isLeaf,
      depth: category.depth,
    })
    .from(category)
    .leftJoin(parent, eq(category.parentId, parent.id))
    .where(eq(category.id, id))
    .limit(1);

  const row = results[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    parentName: row.parentName,
    isLeaf: row.isLeaf,
    depth: row.depth,
  };
}
