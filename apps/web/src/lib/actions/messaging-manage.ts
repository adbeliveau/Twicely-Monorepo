'use server';

import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { conversation, message as messageTable } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isParticipant, fetchConversation } from './messaging-helpers';
import {
  markAsReadSchema,
  archiveConversationSchema,
  reportMessageSchema,
  type MarkAsReadInput,
  type ArchiveConversationInput,
  type ReportMessageInput,
} from '@/lib/validations/messaging';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Mark all messages in a conversation as read for the current user.
 */
export async function markAsRead(input: MarkAsReadInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in' };

  const parsed = markAsReadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { conversationId } = parsed.data;

  const conv = await fetchConversation(conversationId);
  if (!conv) return { success: false, error: 'Not found.' };

  if (!isParticipant(conv, session.userId, session.onBehalfOfSellerId)) {
    return { success: false, error: 'Not found.' };
  }

  const isBuyer = conv.buyerId === session.userId;
  if (!ability.can('update', sub('Conversation', { buyerId: conv.buyerId, sellerId: conv.sellerId }))) {
    return { success: false, error: 'Not found.' };
  }

  const isSeller =
    conv.sellerId === session.userId ||
    (session.onBehalfOfSellerId !== null && conv.sellerId === session.onBehalfOfSellerId);

  await db
    .update(conversation)
    .set({
      buyerUnreadCount: isBuyer ? 0 : conv.buyerUnreadCount,
      sellerUnreadCount: isSeller ? 0 : conv.sellerUnreadCount,
      updatedAt: new Date(),
    })
    .where(eq(conversation.id, conversationId));

  await db
    .update(messageTable)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(messageTable.conversationId, conversationId),
        sql`${messageTable.senderUserId} != ${session.userId}`,
        eq(messageTable.isRead, false),
      ),
    );

  revalidatePath('/my/messages');

  return { success: true };
}

/**
 * Archive a conversation (buyer or seller).
 * Status transitions: OPEN -> ARCHIVED, READ_ONLY -> ARCHIVED.
 */
export async function archiveConversation(
  input: ArchiveConversationInput,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in' };

  const parsed = archiveConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { conversationId } = parsed.data;

  const conv = await fetchConversation(conversationId);
  if (!conv) return { success: false, error: 'Not found.' };

  if (!isParticipant(conv, session.userId, session.onBehalfOfSellerId)) {
    return { success: false, error: 'Not found.' };
  }

  const isBuyer = conv.buyerId === session.userId;
  const allowed = isBuyer
    ? ability.can('update', sub('Conversation', { buyerId: session.userId }))
    : ability.can('update', sub('Conversation', { sellerId: conv.sellerId }));

  if (!allowed) {
    return { success: false, error: 'You do not have permission to archive this conversation' };
  }

  await db
    .update(conversation)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(eq(conversation.id, conversationId));

  revalidatePath('/my/messages');

  return { success: true };
}

/**
 * Report a message for policy violation.
 * Flags the conversation. Does NOT create a helpdesk case (Phase G9).
 */
export async function reportMessage(input: ReportMessageInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in' };

  const parsed = reportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { messageId, reason } = parsed.data;

  const [msg] = await db
    .select({
      id: messageTable.id,
      conversationId: messageTable.conversationId,
    })
    .from(messageTable)
    .where(eq(messageTable.id, messageId))
    .limit(1);

  if (!msg) return { success: false, error: 'Not found.' };

  const conv = await fetchConversation(msg.conversationId);
  if (!conv) return { success: false, error: 'Not found.' };

  if (!isParticipant(conv, session.userId, session.onBehalfOfSellerId)) {
    return { success: false, error: 'Not found.' };
  }

  if (!ability.can('update', sub('Conversation', { buyerId: conv.buyerId, sellerId: conv.sellerId }))) {
    return { success: false, error: 'Not found.' };
  }

  await db
    .update(conversation)
    .set({ isFlagged: true, flagReason: reason, updatedAt: new Date() })
    .where(eq(conversation.id, msg.conversationId));

  revalidatePath('/my/messages');

  return { success: true };
}
