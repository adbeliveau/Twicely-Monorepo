/**
 * Internal helpers for messaging server actions.
 * NOT a 'use server' file — do not export server actions from here.
 */

import { db } from '@twicely/db';
import {
  conversation,
  message as messageTable,
  platformSetting,
} from '@twicely/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';

// ─── Rate Limit ───────────────────────────────────────────────────────────────

/**
 * Read rate limit from platform_settings.
 * Key: comms.messaging.rateLimitPerHour — default 30 per Feature Lock-In S19 + Actors S6.2.
 */
export async function getRateLimitPerHour(): Promise<number> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'comms.messaging.rateLimitPerHour'))
    .limit(1);
  return typeof row?.value === 'number' ? row.value : 30;
}

/**
 * Count messages sent by a user in the past hour.
 */
export async function getMessageCountLastHour(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ count: count() })
    .from(messageTable)
    .where(
      and(
        eq(messageTable.senderUserId, userId),
        sql`${messageTable.createdAt} >= ${oneHourAgo}`,
      ),
    );
  return row?.count ?? 0;
}

// ─── Participant Check ────────────────────────────────────────────────────────

/**
 * Determine if a user is a participant (buyer, seller, or delegated staff).
 */
export function isParticipant(
  conv: { buyerId: string; sellerId: string },
  userId: string,
  onBehalfOfSellerId: string | null,
): boolean {
  return (
    conv.buyerId === userId ||
    conv.sellerId === userId ||
    (onBehalfOfSellerId !== null && conv.sellerId === onBehalfOfSellerId)
  );
}

// ─── Conversation Fetch ───────────────────────────────────────────────────────

export interface ConversationRow {
  id: string;
  buyerId: string;
  sellerId: string;
  status: 'OPEN' | 'READ_ONLY' | 'ARCHIVED';
  buyerUnreadCount: number;
  sellerUnreadCount: number;
}

/**
 * Fetch a conversation by ID for use in server actions.
 */
export async function fetchConversation(
  conversationId: string,
): Promise<ConversationRow | null> {
  const [row] = await db
    .select({
      id: conversation.id,
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      status: conversation.status,
      buyerUnreadCount: conversation.buyerUnreadCount,
      sellerUnreadCount: conversation.sellerUnreadCount,
    })
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  return row ?? null;
}
