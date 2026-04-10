/**
 * KB Article Edit Lock Service
 *
 * Implements pessimistic soft locking to prevent concurrent article editing.
 * Lock TTL is configurable via platform_settings (kb.editLock.ttlMinutes).
 * Expired locks can be acquired by other users.
 */

import { db } from '@twicely/db';
import { kbArticleEditLock } from '@twicely/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

/**
 * Attempts to acquire an edit lock for an article.
 * If the article is already locked by another user and the lock hasn't expired,
 * returns `acquired: false` with the current lock holder info.
 */
export async function acquireLock(
  articleId: string,
  userId: string,
  ttlMinutesOverride?: number,
): Promise<{ acquired: boolean; lockedBy?: string; lockedAt?: Date }> {
  const ttlMinutes = ttlMinutesOverride ??
    await getPlatformSetting<number>('kb.editLock.ttlMinutes', 30);

  const now = new Date();

  // Check for existing lock
  const [existingLock] = await db
    .select()
    .from(kbArticleEditLock)
    .where(eq(kbArticleEditLock.articleId, articleId))
    .limit(1);

  if (existingLock) {
    // If locked by the same user, extend the lock
    if (existingLock.lockedByUserId === userId) {
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
      await db
        .update(kbArticleEditLock)
        .set({ lockedAt: now, expiresAt })
        .where(eq(kbArticleEditLock.id, existingLock.id));
      return { acquired: true };
    }

    // If lock has expired, take it over
    if (existingLock.expiresAt < now) {
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
      await db
        .update(kbArticleEditLock)
        .set({ lockedByUserId: userId, lockedAt: now, expiresAt })
        .where(eq(kbArticleEditLock.id, existingLock.id));
      return { acquired: true };
    }

    // Lock is held by another user and hasn't expired
    return {
      acquired: false,
      lockedBy: existingLock.lockedByUserId,
      lockedAt: existingLock.lockedAt,
    };
  }

  // No existing lock — create one
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  await db.insert(kbArticleEditLock).values({
    id: createId(),
    articleId,
    lockedByUserId: userId,
    lockedAt: now,
    expiresAt,
  });

  return { acquired: true };
}

/**
 * Releases an edit lock. Only the lock holder can release their own lock.
 */
export async function releaseLock(
  articleId: string,
  userId: string,
): Promise<{ released: boolean }> {
  const deleted = await db
    .delete(kbArticleEditLock)
    .where(
      and(
        eq(kbArticleEditLock.articleId, articleId),
        eq(kbArticleEditLock.lockedByUserId, userId),
      ),
    )
    .returning({ id: kbArticleEditLock.id });

  return { released: deleted.length > 0 };
}

/**
 * Checks the current lock status for an article.
 * Returns null if no active (non-expired) lock exists.
 */
export async function checkLock(articleId: string): Promise<{
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
} | null> {
  const now = new Date();
  const [lock] = await db
    .select({
      lockedBy: kbArticleEditLock.lockedByUserId,
      lockedAt: kbArticleEditLock.lockedAt,
      expiresAt: kbArticleEditLock.expiresAt,
    })
    .from(kbArticleEditLock)
    .where(eq(kbArticleEditLock.articleId, articleId))
    .limit(1);

  if (!lock) return null;

  // If expired, return null (treat as unlocked)
  if (lock.expiresAt < now) return null;

  return lock;
}

/**
 * Returns true if the article is locked by someone other than the given user.
 */
export async function isLockedByOther(
  articleId: string,
  userId: string,
): Promise<boolean> {
  const lock = await checkLock(articleId);
  if (!lock) return false;
  return lock.lockedBy !== userId;
}

/**
 * Removes all expired locks from the database.
 * Should be called periodically (e.g., via a cron job).
 */
export async function cleanupExpiredLocks(): Promise<{ removed: number }> {
  const now = new Date();
  const deleted = await db
    .delete(kbArticleEditLock)
    .where(lt(kbArticleEditLock.expiresAt, now))
    .returning({ id: kbArticleEditLock.id });

  return { removed: deleted.length };
}
