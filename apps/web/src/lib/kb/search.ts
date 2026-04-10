/**
 * KB Article Search Service
 *
 * Provides plain-text indexing and search for KB articles.
 * Extracts text from Tiptap JSON content and stores it in kbArticleSearch
 * for simple ILIKE-based search. Typesense integration is a future enhancement.
 */

import { db } from '@twicely/db';
import { kbArticleSearch, kbArticleVersion } from '@twicely/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { extractPlainText } from './tiptap-utils';
import type { TiptapContent } from './types';

/**
 * Indexes an article by extracting plain text from its published version's
 * Tiptap JSON content and upserting into kbArticleSearch.
 */
export async function indexArticle(
  articleId: string,
  contentJson: string,
): Promise<void> {
  let plainText: string;
  try {
    const parsed = JSON.parse(contentJson) as TiptapContent;
    plainText = extractPlainText(parsed);
  } catch {
    // If content is not valid Tiptap JSON, use it as-is (fallback for plain text)
    plainText = contentJson;
  }

  if (!plainText.trim()) {
    plainText = '(empty content)';
  }

  const now = new Date();

  // Check if an index entry already exists
  const [existing] = await db
    .select({ id: kbArticleSearch.id })
    .from(kbArticleSearch)
    .where(eq(kbArticleSearch.articleId, articleId))
    .limit(1);

  if (existing) {
    await db
      .update(kbArticleSearch)
      .set({ indexedContent: plainText, indexedAt: now })
      .where(eq(kbArticleSearch.articleId, articleId));
  } else {
    await db.insert(kbArticleSearch).values({
      id: createId(),
      articleId,
      indexedContent: plainText,
      indexedAt: now,
    });
  }
}

/**
 * Searches indexed KB articles using case-insensitive ILIKE matching.
 * Returns matching article IDs with their indexed content snippets.
 */
export async function searchArticles(query: string): Promise<Array<{
  articleId: string;
  indexedContent: string;
  indexedAt: Date;
}>> {
  if (!query.trim()) {
    return [];
  }

  // Escape special characters for LIKE pattern
  const escaped = query.replace(/%/g, '\%').replace(/_/g, '\_');
  const pattern = `%${escaped}%`;

  return db
    .select({
      articleId: kbArticleSearch.articleId,
      indexedContent: kbArticleSearch.indexedContent,
      indexedAt: kbArticleSearch.indexedAt,
    })
    .from(kbArticleSearch)
    .where(ilike(kbArticleSearch.indexedContent, pattern));
}

/**
 * Reindexes all articles by fetching the latest published version for each
 * article and re-extracting plain text. Used for bulk reindex operations.
 */
export async function reindexAll(): Promise<{ indexed: number }> {
  // Get all distinct article IDs from published versions
  const publishedVersions = await db
    .select({
      articleId: kbArticleVersion.articleId,
      content: kbArticleVersion.content,
    })
    .from(kbArticleVersion)
    .where(eq(kbArticleVersion.status, 'PUBLISHED'));

  let count = 0;
  for (const version of publishedVersions) {
    await indexArticle(version.articleId, version.content);
    count++;
  }

  return { indexed: count };
}
