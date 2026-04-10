import { db } from '@twicely/db';
import { messageSafetyAction } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { logger } from '@twicely/logger';

export interface SafetyAction {
  id: string;
  userId: string;
  actionType: string;
  violationCount: number;
  triggerMessageId: string | null;
  reason: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByStaffId: string | null;
  createdAt: Date;
}

/**
 * Record a violation and apply progressive discipline.
 * Thresholds are read from platform_settings.
 */
export async function recordViolation(
  userId: string,
  triggerMessageId: string,
  reason: string,
): Promise<{ actionTaken: string; violationCount: number }> {
  const thresholds = {
    warning: await getPlatformSetting('messaging.discipline.warningThreshold', 1),
    restrict: await getPlatformSetting('messaging.discipline.restrictThreshold', 2),
    suspend: await getPlatformSetting('messaging.discipline.suspendThreshold', 3),
    banReview: await getPlatformSetting('messaging.discipline.banReviewThreshold', 5),
  };

  // Count existing violations for this user
  const existing = await db
    .select()
    .from(messageSafetyAction)
    .where(eq(messageSafetyAction.userId, userId))
    .orderBy(desc(messageSafetyAction.createdAt));

  const violationCount = existing.length + 1;

  let actionType: 'warning' | 'rate_restrict' | 'messaging_suspend' | 'account_ban';
  let expiresAt: Date | null = null;

  if (violationCount >= thresholds.banReview) {
    actionType = 'account_ban';
  } else if (violationCount >= thresholds.suspend) {
    actionType = 'messaging_suspend';
    // Suspend for 24 hours
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (violationCount >= thresholds.restrict) {
    actionType = 'rate_restrict';
    // Restrict for 1 hour
    expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  } else if (violationCount >= thresholds.warning) {
    actionType = 'warning';
  } else {
    actionType = 'warning';
  }

  await db.insert(messageSafetyAction).values({
    userId,
    actionType,
    violationCount,
    triggerMessageId,
    reason,
    expiresAt,
  });

  logger.warn('Discipline action applied', {
    userId,
    actionType,
    violationCount,
    reason,
  });

  return { actionTaken: actionType, violationCount };
}

/**
 * Get all active (non-revoked, non-expired) safety actions for a user.
 */
export async function getActiveSafetyActions(userId: string): Promise<SafetyAction[]> {
  const now = new Date();

  const rows = await db
    .select()
    .from(messageSafetyAction)
    .where(
      and(
        eq(messageSafetyAction.userId, userId),
        isNull(messageSafetyAction.revokedAt),
      ),
    )
    .orderBy(desc(messageSafetyAction.createdAt));

  // Filter out expired actions in application layer (expiresAt is nullable — null means permanent)
  return rows.filter(
    (row) => row.expiresAt === null || row.expiresAt >= now,
  ) as SafetyAction[];
}

/**
 * Revoke a safety action (staff action).
 */
export async function revokeSafetyAction(actionId: string, staffId: string): Promise<void> {
  await db
    .update(messageSafetyAction)
    .set({
      revokedAt: new Date(),
      revokedByStaffId: staffId,
    })
    .where(eq(messageSafetyAction.id, actionId));

  logger.info('Safety action revoked', { actionId, staffId });
}

/**
 * Check if a user currently has an active messaging_suspend action.
 */
export async function isMessagingSuspended(userId: string): Promise<boolean> {
  const actions = await getActiveSafetyActions(userId);
  return actions.some(
    (a) => a.actionType === 'messaging_suspend' || a.actionType === 'account_ban',
  );
}
