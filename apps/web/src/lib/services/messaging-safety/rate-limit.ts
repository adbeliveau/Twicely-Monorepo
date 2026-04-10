import { db } from '@twicely/db';
import { messageRateLimit, messageSafetyAction } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Get the start of the current hour window for rate limiting.
 */
function getCurrentWindowStart(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now;
}

/**
 * Check whether a user is allowed to send another message within the current rate window.
 */
export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const enabled = await getPlatformSetting('messaging.rateLimit.enabled', true);
  const maxPerHour = await getPlatformSetting('messaging.rateLimit.messagesPerHour', 20);

  const windowStart = getCurrentWindowStart();
  const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);

  if (!enabled) {
    return { allowed: true, remaining: maxPerHour, resetAt };
  }

  const rows = await db
    .select()
    .from(messageRateLimit)
    .where(
      and(
        eq(messageRateLimit.userId, userId),
        eq(messageRateLimit.windowStart, windowStart),
      ),
    )
    .limit(1);

  const current = rows[0]?.messageCount ?? 0;
  const remaining = Math.max(0, maxPerHour - current);

  if (current >= maxPerHour) {
    logger.warn('Rate limit reached for user', { userId, current, maxPerHour });
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

/**
 * Increment the message count for the current rate window.
 */
export async function incrementRateLimit(userId: string): Promise<void> {
  const windowStart = getCurrentWindowStart();

  // Upsert: insert or increment existing count
  const existing = await db
    .select()
    .from(messageRateLimit)
    .where(
      and(
        eq(messageRateLimit.userId, userId),
        eq(messageRateLimit.windowStart, windowStart),
      ),
    )
    .limit(1);

  const current = existing[0];
  if (current) {
    await db
      .update(messageRateLimit)
      .set({ messageCount: current.messageCount + 1 })
      .where(eq(messageRateLimit.id, current.id));
  } else {
    await db
      .insert(messageRateLimit)
      .values({
        userId,
        windowStart,
        messageCount: 1,
      });
  }
}

/**
 * Check if a user has an active rate_restrict safety action.
 */
export async function isUserRateRestricted(userId: string): Promise<boolean> {
  const now = new Date();

  const rows = await db
    .select()
    .from(messageSafetyAction)
    .where(
      and(
        eq(messageSafetyAction.userId, userId),
        eq(messageSafetyAction.actionType, 'rate_restrict'),
        isNull(messageSafetyAction.revokedAt),
        gte(messageSafetyAction.expiresAt, now),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
