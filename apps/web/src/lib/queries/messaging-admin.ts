import { db } from '@twicely/db';
import { conversation } from '@twicely/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export interface FlaggedConversationRow {
  id: string;
  subject: string | null;
  buyerName: string;
  sellerName: string;
  flagReason: string | null;
  lastMessageAt: Date | null;
}

/**
 * Get flagged conversations for admin review.
 * Ordered by lastMessageAt DESC. Limit 50.
 */
export async function getFlaggedConversations(): Promise<FlaggedConversationRow[]> {
  const rows = await db
    .select({
      id: conversation.id,
      subject: conversation.subject,
      flagReason: conversation.flagReason,
      lastMessageAt: conversation.lastMessageAt,
      buyerName: sql<string>`(SELECT u.name FROM "user" u WHERE u.id = ${conversation.buyerId} LIMIT 1)`.as('buyer_name'),
      sellerName: sql<string>`(SELECT u.name FROM "user" u WHERE u.id = ${conversation.sellerId} LIMIT 1)`.as('seller_name'),
    })
    .from(conversation)
    .where(eq(conversation.isFlagged, true))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    buyerName: r.buyerName ?? 'Unknown',
    sellerName: r.sellerName ?? 'Unknown',
    flagReason: r.flagReason,
    lastMessageAt: r.lastMessageAt,
  }));
}
