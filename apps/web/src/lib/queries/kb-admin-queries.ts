import { db } from '@twicely/db';
import { kbCategory, kbArticle, staffUser } from '@twicely/db/schema';
import { asc, desc, count, eq, and } from 'drizzle-orm';

export interface AdminKbCategoryItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  articleCount: number;
}

/** All categories (including inactive) with article count per category — admin use only */
export async function getAdminKbCategories(): Promise<AdminKbCategoryItem[]> {
  const categories = await db
    .select({
      id: kbCategory.id,
      slug: kbCategory.slug,
      name: kbCategory.name,
      description: kbCategory.description,
      icon: kbCategory.icon,
      sortOrder: kbCategory.sortOrder,
      isActive: kbCategory.isActive,
      parentId: kbCategory.parentId,
    })
    .from(kbCategory)
    .orderBy(asc(kbCategory.sortOrder));

  const articleCounts = await db
    .select({
      categoryId: kbArticle.categoryId,
      cnt: count(kbArticle.id).as('cnt'),
    })
    .from(kbArticle)
    .groupBy(kbArticle.categoryId);

  const countMap = new Map(
    articleCounts.map((r) => [r.categoryId, Number(r.cnt)])
  );

  return categories.map((c) => ({
    ...c,
    articleCount: countMap.get(c.id) ?? 0,
  }));
}

export interface AdminKbArticleItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  audience: string;
  isFeatured: boolean;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
  authorName: string | null;
}

/** All articles for KB admin list with optional filters */
export async function getAdminKbArticles(filters?: {
  status?: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  audience?: 'ALL' | 'BUYER' | 'SELLER' | 'AGENT_ONLY';
}): Promise<AdminKbArticleItem[]> {
  const conditions = [];
  if (filters?.status) conditions.push(eq(kbArticle.status, filters.status));
  if (filters?.categoryId) conditions.push(eq(kbArticle.categoryId, filters.categoryId));
  if (filters?.audience) conditions.push(eq(kbArticle.audience, filters.audience));

  const rows = await db
    .select({
      id: kbArticle.id,
      slug: kbArticle.slug,
      title: kbArticle.title,
      excerpt: kbArticle.excerpt,
      status: kbArticle.status,
      audience: kbArticle.audience,
      isFeatured: kbArticle.isFeatured,
      viewCount: kbArticle.viewCount,
      helpfulYes: kbArticle.helpfulYes,
      helpfulNo: kbArticle.helpfulNo,
      updatedAt: kbArticle.updatedAt,
      categoryId: kbArticle.categoryId,
      categoryName: kbCategory.name,
      authorName: staffUser.displayName,
    })
    .from(kbArticle)
    .leftJoin(kbCategory, eq(kbArticle.categoryId, kbCategory.id))
    .leftJoin(staffUser, eq(kbArticle.authorStaffId, staffUser.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(kbArticle.updatedAt))
    .limit(100);

  return rows.map((r) => ({
    ...r,
    categoryName: r.categoryName ?? null,
    authorName: r.authorName ?? null,
  }));
}
