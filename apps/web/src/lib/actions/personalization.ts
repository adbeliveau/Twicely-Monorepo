'use server';

import { db } from '@twicely/db';
import { interestTag, userInterest } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { createId } from '@paralleldrive/cuid2';
import { saveUserInterestsSchema } from '@/lib/validations/personalization';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Save the user's explicit interest tag selections.
 * Replaces any existing EXPLICIT interests for this user.
 * Requires authentication.
 */
export async function saveUserInterestsAction(
  input: unknown
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = saveUserInterestsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tagSlugs } = parsed.data;

  const userId = session.userId;

  // Verify all provided slugs exist in the interestTag table
  const foundTags = await db
    .select({ slug: interestTag.slug })
    .from(interestTag)
    .where(inArray(interestTag.slug, tagSlugs));

  if (foundTags.length !== tagSlugs.length) {
    return { success: false, error: 'One or more interest tags are invalid' };
  }

  // Delete existing EXPLICIT interests for this user (replace, not append)
  await db
    .delete(userInterest)
    .where(and(eq(userInterest.userId, userId), eq(userInterest.source, 'EXPLICIT')));

  // Insert new EXPLICIT interest rows
  await db.insert(userInterest).values(
    tagSlugs.map((slug) => ({
      id: createId(),
      userId,
      tagSlug: slug,
      weight: '10.0',
      source: 'EXPLICIT' as const,
      expiresAt: null,
    }))
  );

  return { success: true };
}
