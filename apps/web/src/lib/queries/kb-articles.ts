import { db } from '@twicely/db';
import { kbCategory, kbArticle, kbArticleRelation } from '@twicely/db/schema';
import { eq, and, asc, desc, inArray, count, sql, or, ilike } from 'drizzle-orm';

export interface KbCategoryItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  articleCount: number;
}

export interface KbArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: string;
  audience: string;
  isFeatured: boolean;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  updatedAt: Date;
  categoryId: string | null;
}

export interface KbArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  bodyFormat: string;
  status: string;
  audience: string;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  isFeatured: boolean;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  version: number;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryId: string | null;
  relatedArticles: { id: string; slug: string; title: string }[];
}

type KbAudienceValue = 'ALL' | 'BUYER' | 'SELLER' | 'AGENT_ONLY';

function buildAudienceFilter(userAudience: 'ALL' | 'BUYER' | 'SELLER' | null): readonly KbAudienceValue[] {
  if (userAudience === 'SELLER') return ['ALL', 'BUYER', 'SELLER'] as const;
  if (userAudience === 'BUYER') return ['ALL', 'BUYER'] as const;
  return ['ALL'] as const;
}

/** Public help center categories (isActive = true, audience matches) */
export async function getPublicKbCategories(
  userAudience: 'ALL' | 'BUYER' | 'SELLER' | null
): Promise<KbCategoryItem[]> {
  const audienceValues = buildAudienceFilter(userAudience);

  const categories = await db
    .select({
      id: kbCategory.id,
      slug: kbCategory.slug,
      name: kbCategory.name,
      description: kbCategory.description,
      icon: kbCategory.icon,
      sortOrder: kbCategory.sortOrder,
    })
    .from(kbCategory)
    .where(eq(kbCategory.isActive, true))
    .orderBy(asc(kbCategory.sortOrder));

  // Count published articles per category
  const articleCounts = await db
    .select({
      categoryId: kbArticle.categoryId,
      cnt: count(kbArticle.id).as('cnt'),
    })
    .from(kbArticle)
    .where(
      and(
        eq(kbArticle.status, 'PUBLISHED'),
        inArray(kbArticle.audience, audienceValues)
      )
    )
    .groupBy(kbArticle.categoryId);

  const countMap = new Map(articleCounts.map((r) => [r.categoryId, Number(r.cnt)]));

  return categories.map((c) => ({
    ...c,
    articleCount: countMap.get(c.id) ?? 0,
  }));
}

/** Articles in a category (published + audience-gated) */
export async function getKbArticlesByCategory(
  categorySlug: string,
  userAudience: 'ALL' | 'BUYER' | 'SELLER' | null
): Promise<{ category: { id: string; name: string; description: string | null } | null; articles: KbArticleListItem[] }> {
  const audienceValues = buildAudienceFilter(userAudience);

  const cats = await db
    .select()
    .from(kbCategory)
    .where(eq(kbCategory.slug, categorySlug))
    .limit(1);

  const cat = cats[0];
  if (!cat) return { category: null, articles: [] };

  const articles = await db
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
    })
    .from(kbArticle)
    .where(
      and(
        eq(kbArticle.categoryId, cat.id),
        eq(kbArticle.status, 'PUBLISHED'),
        inArray(kbArticle.audience, audienceValues)
      )
    )
    .orderBy(asc(kbArticle.title));

  return { category: { id: cat.id, name: cat.name, description: cat.description }, articles };
}

/** Single article by slug for public help center */
export async function getKbArticleBySlug(
  slug: string
): Promise<KbArticleDetail | null> {
  const articles = await db
    .select()
    .from(kbArticle)
    .where(eq(kbArticle.slug, slug))
    .limit(1);

  const article = articles[0];
  if (!article) return null;

  // Related articles
  const relations = await db
    .select({
      id: kbArticle.id,
      slug: kbArticle.slug,
      title: kbArticle.title,
    })
    .from(kbArticleRelation)
    .innerJoin(kbArticle, eq(kbArticleRelation.relatedArticleId, kbArticle.id))
    .where(eq(kbArticleRelation.articleId, article.id));

  // Async view count increment — fire and forget
  db.update(kbArticle)
    .set({ viewCount: sql`${kbArticle.viewCount} + 1` })
    .where(eq(kbArticle.id, article.id))
    .catch(() => {});

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    body: article.body,
    bodyFormat: article.bodyFormat,
    status: article.status,
    audience: article.audience,
    tags: article.tags,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    isFeatured: article.isFeatured,
    viewCount: article.viewCount,
    helpfulYes: article.helpfulYes,
    helpfulNo: article.helpfulNo,
    version: article.version,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    categoryId: article.categoryId,
    relatedArticles: relations,
  };
}

/** Featured articles for help center home */
export async function getFeaturedKbArticles(
  userAudience: 'ALL' | 'BUYER' | 'SELLER' | null
): Promise<KbArticleListItem[]> {
  const audienceValues = buildAudienceFilter(userAudience);

  return db
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
    })
    .from(kbArticle)
    .where(
      and(
        eq(kbArticle.isFeatured, true),
        eq(kbArticle.status, 'PUBLISHED'),
        inArray(kbArticle.audience, audienceValues)
      )
    )
    .orderBy(desc(kbArticle.viewCount))
    .limit(6);
}

/** Full-text search across KB articles (DB ILIKE) */
export async function searchKbArticles(
  query: string,
  userAudience: 'ALL' | 'BUYER' | 'SELLER' | null,
  categorySlug?: string,
  limit?: number
): Promise<KbArticleListItem[]> {
  const audienceValues = buildAudienceFilter(userAudience);
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const wordConditions = words.map((word) =>
    or(
      ilike(kbArticle.title, `%${word}%`),
      ilike(kbArticle.excerpt, `%${word}%`),
      ilike(kbArticle.body, `%${word}%`)
    )
  );

  const baseConditions = [
    eq(kbArticle.status, 'PUBLISHED'),
    inArray(kbArticle.audience, audienceValues),
    ...wordConditions,
  ];

  if (categorySlug) {
    const cats = await db
      .select({ id: kbCategory.id })
      .from(kbCategory)
      .where(eq(kbCategory.slug, categorySlug))
      .limit(1);
    if (!cats[0]) return [];
    baseConditions.push(eq(kbArticle.categoryId, cats[0].id));
  }

  return db
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
    })
    .from(kbArticle)
    .where(and(...baseConditions))
    .orderBy(desc(kbArticle.viewCount))
    .limit(limit ?? 20);
}

