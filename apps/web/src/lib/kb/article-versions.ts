/**
 * KB Article Version Service
 *
 * Manages article versioning with auto-incrementing version numbers.
 * Supports create, list, get, publish, and revert operations.
 * Only one version per article can be in PUBLISHED status at a time.
 */

import { db } from '@twicely/db';
import { kbArticleVersion } from '@twicely/db/schema';
import { eq, and, desc, max } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { ArticleVersionInput, ArticleStatus } from './types';

/**
 * Creates a new version for an article. Version numbers auto-increment
 * per article (1, 2, 3...).
 */
export async function createVersion(
  articleId: string,
  input: ArticleVersionInput,
  authorId: string,
): Promise<{ id: string; versionNumber: number }> {
  // Get the current max version number for this article
  const [maxResult] = await db
    .select({ maxVersion: max(kbArticleVersion.versionNumber) })
    .from(kbArticleVersion)
    .where(eq(kbArticleVersion.articleId, articleId));

  const nextVersion = (maxResult?.maxVersion ?? 0) + 1;
  const id = createId();

  await db.insert(kbArticleVersion).values({
    id,
    articleId,
    versionNumber: nextVersion,
    title: input.title,
    slug: input.slug,
    content: input.content,
    excerpt: input.excerpt ?? null,
    authorId,
    status: input.status,
    publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
    createdAt: new Date(),
  });

  return { id, versionNumber: nextVersion };
}

/**
 * Returns all versions for an article, ordered by version number descending.
 */
export async function getVersions(articleId: string): Promise<Array<{
  id: string;
  versionNumber: number;
  title: string;
  status: string;
  authorId: string;
  createdAt: Date;
}>> {
  return db
    .select({
      id: kbArticleVersion.id,
      versionNumber: kbArticleVersion.versionNumber,
      title: kbArticleVersion.title,
      status: kbArticleVersion.status,
      authorId: kbArticleVersion.authorId,
      createdAt: kbArticleVersion.createdAt,
    })
    .from(kbArticleVersion)
    .where(eq(kbArticleVersion.articleId, articleId))
    .orderBy(desc(kbArticleVersion.versionNumber));
}

/**
 * Returns a specific version by its ID.
 */
export async function getVersion(versionId: string): Promise<{
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  authorId: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
} | null> {
  const [version] = await db
    .select()
    .from(kbArticleVersion)
    .where(eq(kbArticleVersion.id, versionId))
    .limit(1);

  return version ?? null;
}

/**
 * Publishes a specific version. Sets the version status to PUBLISHED with a
 * publishedAt timestamp. Unpublishes any other PUBLISHED version for the same article.
 */
export async function publishVersion(
  versionId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const version = await getVersion(versionId);
  if (!version) {
    return { success: false, error: 'Version not found' };
  }

  // Unpublish any currently published version for this article
  await db
    .update(kbArticleVersion)
    .set({ status: 'ARCHIVED' as ArticleStatus })
    .where(
      and(
        eq(kbArticleVersion.articleId, version.articleId),
        eq(kbArticleVersion.status, 'PUBLISHED'),
      ),
    );

  // Publish the target version (userId tracked for audit trail via authorId on version)
  await db
    .update(kbArticleVersion)
    .set({
      status: 'PUBLISHED' as ArticleStatus,
      publishedAt: new Date(),
      authorId: userId,
    })
    .where(eq(kbArticleVersion.id, versionId));

  return { success: true };
}

/**
 * Returns the currently published version for an article, if any.
 */
export async function getPublishedVersion(articleId: string): Promise<{
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  authorId: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
} | null> {
  const [version] = await db
    .select()
    .from(kbArticleVersion)
    .where(
      and(
        eq(kbArticleVersion.articleId, articleId),
        eq(kbArticleVersion.status, 'PUBLISHED'),
      ),
    )
    .limit(1);

  return version ?? null;
}

/**
 * Reverts an article to a specific version number by creating a new version
 * with the content from the target version. Does NOT auto-publish.
 */
export async function revertToVersion(
  articleId: string,
  versionNumber: number,
  authorId: string,
): Promise<{ success: boolean; newVersionId?: string; error?: string }> {
  // Find the target version
  const [targetVersion] = await db
    .select()
    .from(kbArticleVersion)
    .where(
      and(
        eq(kbArticleVersion.articleId, articleId),
        eq(kbArticleVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);

  if (!targetVersion) {
    return { success: false, error: 'Target version not found' };
  }

  // Create a new draft version with the old content
  const result = await createVersion(articleId, {
    title: targetVersion.title,
    slug: targetVersion.slug,
    content: targetVersion.content,
    excerpt: targetVersion.excerpt,
    status: 'DRAFT',
  }, authorId);

  return { success: true, newVersionId: result.id };
}
