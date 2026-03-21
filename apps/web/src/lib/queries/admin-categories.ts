import { db } from '@twicely/db';
import { category, categoryAttributeSchema, listing } from '@twicely/db/schema';
import { eq, ilike, and, sql, isNull, inArray } from 'drizzle-orm';

export interface AdminCategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  listingCount: number;
  attributeSchemaCount: number;
  children: AdminCategoryNode[];
}

export interface AdminCategoryDetail {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  icon: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  listingCount: number;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
    listingCount: number;
  }>;
  attributeSchemas: Array<{
    id: string;
    name: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    isRecommended: boolean;
    showInFilters: boolean;
    showInListing: boolean;
    optionsJson: unknown;
    validationJson: unknown;
    sortOrder: number;
  }>;
}

interface CatalogBrowserFilters {
  search?: string;
  isActive?: boolean;
  feeBucket?: string;
  parentId?: string | null;
  page?: number;
  pageSize?: number;
}

interface FlatCategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  feeBucket: string;
  depth: number;
  isActive: boolean;
  sortOrder: number;
  listingCount: number;
}

interface CatalogBrowserResult {
  categories: FlatCategoryRow[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export async function getAdminCategoryTree(): Promise<AdminCategoryNode[]> {
  const [allCategories, listingCounts, schemaCounts] = await Promise.all([
    db.select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      feeBucket: category.feeBucket,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      isLeaf: category.isLeaf,
      depth: category.depth,
      path: category.path,
    }).from(category),
    db.select({
      categoryId: listing.categoryId,
      cnt: sql<number>`count(*)::int`,
    }).from(listing).where(eq(listing.status, 'ACTIVE')).groupBy(listing.categoryId),
    db.select({
      categoryId: categoryAttributeSchema.categoryId,
      cnt: sql<number>`count(*)::int`,
    }).from(categoryAttributeSchema).groupBy(categoryAttributeSchema.categoryId),
  ]);

  const listingMap = new Map(listingCounts.map((r) => [r.categoryId, r.cnt]));
  const schemaMap = new Map(schemaCounts.map((r) => [r.categoryId, r.cnt]));

  const nodeMap = new Map<string, AdminCategoryNode>();
  const roots: AdminCategoryNode[] = [];

  for (const cat of allCategories) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      feeBucket: cat.feeBucket,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      isLeaf: cat.isLeaf,
      depth: cat.depth,
      path: cat.path,
      listingCount: listingMap.get(cat.id) ?? 0,
      attributeSchemaCount: schemaMap.get(cat.id) ?? 0,
      children: [],
    });
  }

  for (const cat of allCategories) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parentId === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(cat.parentId);
      if (parent) parent.children.push(node);
    }
  }

  return roots;
}

export async function getAdminCategoryById(id: string): Promise<AdminCategoryDetail | null> {
  const rows = await db.select({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    description: category.description,
    icon: category.icon,
    feeBucket: category.feeBucket,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    isLeaf: category.isLeaf,
    depth: category.depth,
    path: category.path,
    metaTitle: category.metaTitle,
    metaDescription: category.metaDescription,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }).from(category).where(eq(category.id, id)).limit(1);

  const cat = rows[0];
  if (!cat) return null;

  const parentAlias = { id: category.id, name: category.name };
  const [parentRows, children, schemas, listingCountRows] = await Promise.all([
    cat.parentId
      ? db.select(parentAlias).from(category).where(eq(category.id, cat.parentId)).limit(1)
      : Promise.resolve([]),
    db.select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    }).from(category).where(eq(category.parentId, id)),
    db.select({
      id: categoryAttributeSchema.id,
      name: categoryAttributeSchema.name,
      label: categoryAttributeSchema.label,
      fieldType: categoryAttributeSchema.fieldType,
      isRequired: categoryAttributeSchema.isRequired,
      isRecommended: categoryAttributeSchema.isRecommended,
      showInFilters: categoryAttributeSchema.showInFilters,
      showInListing: categoryAttributeSchema.showInListing,
      optionsJson: categoryAttributeSchema.optionsJson,
      validationJson: categoryAttributeSchema.validationJson,
      sortOrder: categoryAttributeSchema.sortOrder,
    }).from(categoryAttributeSchema).where(eq(categoryAttributeSchema.categoryId, id)),
    db.select({ cnt: sql<number>`count(*)::int` }).from(listing)
      .where(and(eq(listing.categoryId, id), eq(listing.status, 'ACTIVE'))),
  ]);

  const childIds = children.map((c) => c.id);
  let childListingMap = new Map<string, number>();
  if (childIds.length > 0) {
    const childCounts = await db.select({
      categoryId: listing.categoryId,
      cnt: sql<number>`count(*)::int`,
    }).from(listing).where(eq(listing.status, 'ACTIVE')).groupBy(listing.categoryId);
    childListingMap = new Map(
      childCounts
        .filter((r): r is { categoryId: string; cnt: number } => r.categoryId !== null)
        .map((r) => [r.categoryId, r.cnt])
    );
  }

  return {
    ...cat,
    parentName: parentRows[0]?.name ?? null,
    listingCount: listingCountRows[0]?.cnt ?? 0,
    children: children.map((c) => ({
      ...c,
      listingCount: childListingMap.get(c.id) ?? 0,
    })),
    attributeSchemas: schemas,
  };
}

export async function getAdminCatalogBrowser(
  filters: CatalogBrowserFilters
): Promise<CatalogBrowserResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters.search) {
    conditions.push(ilike(category.name, `%${filters.search}%`));
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(category.isActive, filters.isActive));
  }
  if (filters.feeBucket !== undefined) {
    conditions.push(eq(category.feeBucket, filters.feeBucket as 'ELECTRONICS' | 'APPAREL_ACCESSORIES' | 'HOME_GENERAL' | 'COLLECTIBLES_LUXURY'));
  }
  if (filters.parentId === null) {
    conditions.push(isNull(category.parentId));
  } else if (filters.parentId !== undefined) {
    conditions.push(eq(category.parentId, filters.parentId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRows, listingCounts] = await Promise.all([
    db.select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      feeBucket: category.feeBucket,
      depth: category.depth,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    }).from(category).where(whereClause).limit(pageSize).offset(offset),
    db.select({ cnt: sql<number>`count(*)::int` }).from(category).where(whereClause),
    db.select({
      categoryId: listing.categoryId,
      cnt: sql<number>`count(*)::int`,
    }).from(listing).where(eq(listing.status, 'ACTIVE')).groupBy(listing.categoryId),
  ]);

  const totalCount = countRows[0]?.cnt ?? 0;
  const listingMap = new Map(listingCounts.map((r) => [r.categoryId, r.cnt]));

  const parentIds = [...new Set(rows.map((r) => r.parentId).filter((id): id is string => id !== null))];
  let parentNameMap = new Map<string, string>();
  if (parentIds.length > 0) {
    const parents = await db.select({ id: category.id, name: category.name })
      .from(category).where(inArray(category.id, parentIds));
    parentNameMap = new Map(parents.map((p) => [p.id, p.name]));
  }

  const categories: FlatCategoryRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parentId,
    parentName: r.parentId ? (parentNameMap.get(r.parentId) ?? null) : null,
    feeBucket: r.feeBucket,
    depth: r.depth,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    listingCount: listingMap.get(r.id) ?? 0,
  }));

  return {
    categories,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
