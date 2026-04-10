import { db } from '@twicely/db';
import { buyerBlockList, messageSafetyAction } from '@twicely/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Check whether a sender is allowed to message a recipient.
 * Checks:
 * 1. Buyer block list (bidirectional)
 * 2. Active messaging_suspend or account_ban safety actions on the sender
 * 3. Staff role bypass
 */
export async function canSendMessage(
  senderId: string,
  recipientId: string,
  senderRole?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // Staff can always send messages (moderation / support)
  const staffRoles = [
    'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
    'SUPPORT', 'MODERATION', 'ADMIN', 'SUPER_ADMIN',
  ];

  if (senderRole && staffRoles.includes(senderRole)) {
    return { allowed: true };
  }

  // Check if the recipient blocked the sender (or vice versa)
  const blockRows = await db
    .select()
    .from(buyerBlockList)
    .where(
      or(
        and(
          eq(buyerBlockList.blockerId, recipientId),
          eq(buyerBlockList.blockedId, senderId),
        ),
        and(
          eq(buyerBlockList.blockerId, senderId),
          eq(buyerBlockList.blockedId, recipientId),
        ),
      ),
    )
    .limit(1);

  if (blockRows.length > 0) {
    logger.info('Message blocked: user block list', { senderId, recipientId });
    return { allowed: false, reason: 'You cannot message this user' };
  }

  // Check active safety actions (suspend / ban)
  const now = new Date();
  const safetyRows = await db
    .select()
    .from(messageSafetyAction)
    .where(
      and(
        eq(messageSafetyAction.userId, senderId),
        isNull(messageSafetyAction.revokedAt),
        or(
          eq(messageSafetyAction.actionType, 'messaging_suspend'),
          eq(messageSafetyAction.actionType, 'account_ban'),
        ),
      ),
    )
    .limit(1);

  // Filter: only active if expiresAt is null (permanent) or in the future
  const activeAction = safetyRows.find(
    (row) => row.expiresAt === null || row.expiresAt >= now,
  );

  if (activeAction) {
    const reasonMap: Record<string, string> = {
      messaging_suspend: 'Your messaging privileges are temporarily suspended',
      account_ban: 'Your account has been restricted',
    };

    logger.info('Message blocked: safety action', {
      senderId,
      actionType: activeAction.actionType,
    });

    return {
      allowed: false,
      reason: reasonMap[activeAction.actionType] ?? 'Messaging is not available',
    };
  }

  return { allowed: true };
}
