'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { follow } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';

const toggleFollowSchema = z.object({
  sellerUserId: z.string().cuid2(),
}).strict();

interface ActionResult {
  success: boolean;
  isFollowing?: boolean;
  error?: string;
}

/**
 * Toggle follow status for a seller.
 * Returns the new follow state.
 */
export async function toggleFollow(sellerUserId: string): Promise<ActionResult> {
  const parsed = toggleFollowSchema.safeParse({ sellerUserId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const userId = session.userId;

  if (userId === sellerUserId) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  // Check if already following
  const [existing] = await db
    .select({ id: follow.id })
    .from(follow)
    .where(and(eq(follow.followerId, userId), eq(follow.followedId, sellerUserId)))
    .limit(1);

  if (existing) {
    // Unfollow
    await db.delete(follow).where(eq(follow.id, existing.id));
    revalidatePath('/st');
    return { success: true, isFollowing: false };
  } else {
    // Follow
    await db.insert(follow).values({
      followerId: userId,
      followedId: sellerUserId,
    });
    revalidatePath('/st');
    return { success: true, isFollowing: true };
  }
}

/**
 * Check if the current user is following a seller.
 */
export async function getIsFollowing(sellerUserId: string): Promise<boolean> {
  const { session } = await authorize();
  if (!session) return false;
  const userId = session.userId;

  const [existing] = await db
    .select({ id: follow.id })
    .from(follow)
    .where(and(eq(follow.followerId, userId), eq(follow.followedId, sellerUserId)))
    .limit(1);

  return !!existing;
}
