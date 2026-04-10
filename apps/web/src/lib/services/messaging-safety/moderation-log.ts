import { db } from '@twicely/db';
import { messageModerationLog, message, conversation } from '@twicely/db/schema';
import { eq, and, inArray, lt, desc } from 'drizzle-orm';
import { logger } from '@twicely/logger';

export interface ModerationQueueItem {
  id: string;
  messageId: string;
  action: string;
  reason: string;
  matchedKeywords: string[];
  aiConfidence: number | null;
  staffId: string | null;
  createdAt: Date;
}

/**
 * Log a moderation event for a message.
 */
export async function logModeration(input: {
  messageId: string;
  action: string;
  reason: string;
  matchedKeywords?: string[];
  aiConfidence?: number;
  staffId?: string;
}): Promise<string> {
  const rows = await db
    .insert(messageModerationLog)
    .values({
      messageId: input.messageId,
      action: input.action as 'auto_blocked' | 'auto_flagged' | 'ai_flagged' | 'manual_flagged' | 'manual_hidden' | 'manual_cleared' | 'manual_restored',
      reason: input.reason,
      matchedKeywords: input.matchedKeywords ?? [],
      aiConfidence: input.aiConfidence ?? null,
      staffId: input.staffId ?? null,
    })
    .returning({ id: messageModerationLog.id });

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to insert moderation log entry');
  }
  const id = row.id;

  logger.info('Moderation event logged', {
    moderationId: id,
    messageId: input.messageId,
    action: input.action,
  });

  return id;
}

/**
 * Get the moderation queue with cursor-based pagination.
 */
export async function getModerationQueue(opts: {
  status?: string[];
  cursor?: string;
  limit?: number;
}): Promise<{ messages: ModerationQueueItem[]; nextCursor?: string }> {
  const limit = opts.limit ?? 20;

  let query = db
    .select({
      id: messageModerationLog.id,
      messageId: messageModerationLog.messageId,
      action: messageModerationLog.action,
      reason: messageModerationLog.reason,
      matchedKeywords: messageModerationLog.matchedKeywords,
      aiConfidence: messageModerationLog.aiConfidence,
      staffId: messageModerationLog.staffId,
      createdAt: messageModerationLog.createdAt,
    })
    .from(messageModerationLog)
    .orderBy(desc(messageModerationLog.createdAt))
    .limit(limit + 1)
    .$dynamic();

  const conditions = [];

  if (opts.status && opts.status.length > 0) {
    conditions.push(
      inArray(
        messageModerationLog.action,
        opts.status as ('auto_blocked' | 'auto_flagged' | 'ai_flagged' | 'manual_flagged' | 'manual_hidden' | 'manual_cleared' | 'manual_restored')[],
      ),
    );
  }

  if (opts.cursor) {
    conditions.push(lt(messageModerationLog.id, opts.cursor));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query;

  let nextCursor: string | undefined;
  if (rows.length > limit) {
    const last = rows.pop();
    nextCursor = last?.id;
  }

  return { messages: rows as ModerationQueueItem[], nextCursor };
}

/**
 * Take a moderation action on a message (staff action).
 */
export async function moderateMessage(input: {
  messageId: string;
  action: 'flag' | 'clear' | 'hide' | 'restore';
  reason?: string;
  staffId: string;
}): Promise<void> {
  const actionMap: Record<string, 'manual_flagged' | 'manual_hidden' | 'manual_cleared' | 'manual_restored'> = {
    flag: 'manual_flagged',
    clear: 'manual_cleared',
    hide: 'manual_hidden',
    restore: 'manual_restored',
  };

  const moderationAction = actionMap[input.action];
  if (!moderationAction) {
    throw new Error(`Invalid moderation action: ${input.action}`);
  }

  await db.insert(messageModerationLog).values({
    messageId: input.messageId,
    action: moderationAction,
    reason: input.reason ?? `Staff ${input.action} action`,
    staffId: input.staffId,
  });

  // Update conversation flag status for hide/flag actions
  if (input.action === 'flag' || input.action === 'hide') {
    const msgRows = await db
      .select({ conversationId: message.conversationId })
      .from(message)
      .where(eq(message.id, input.messageId))
      .limit(1);

    if (msgRows[0]) {
      await db
        .update(conversation)
        .set({ isFlagged: true, flagReason: input.reason ?? `Staff ${input.action}` })
        .where(eq(conversation.id, msgRows[0].conversationId));
    }
  }

  // Clear conversation flag on restore/clear
  if (input.action === 'clear' || input.action === 'restore') {
    const msgRows = await db
      .select({ conversationId: message.conversationId })
      .from(message)
      .where(eq(message.id, input.messageId))
      .limit(1);

    if (msgRows[0]) {
      await db
        .update(conversation)
        .set({ isFlagged: false, flagReason: null })
        .where(eq(conversation.id, msgRows[0].conversationId));
    }
  }

  logger.info('Message moderated by staff', {
    messageId: input.messageId,
    action: input.action,
    staffId: input.staffId,
  });
}
