import { db } from '@twicely/db';
import { interestTag, userInterest } from '@twicely/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export type InterestTag = typeof interestTag.$inferSelect;

/**
 * Fetch all active interest tags ordered by displayOrder then label.
 */
export async function getInterestTags(): Promise<InterestTag[]> {
  return db
    .select()
    .from(interestTag)
    .where(eq(interestTag.isActive, true))
    .orderBy(asc(interestTag.displayOrder), asc(interestTag.label));
}

/**
 * Get tag slugs for a user's EXPLICIT interests.
 * Returns empty array if user has no explicit interests.
 */
export async function getUserExplicitInterests(userId: string): Promise<string[]> {
  const rows = await db
    .select({ tagSlug: userInterest.tagSlug })
    .from(userInterest)
    .where(and(eq(userInterest.userId, userId), eq(userInterest.source, 'EXPLICIT')));

  return rows.map((r) => r.tagSlug);
}
