/**
 * Centrifugo channel name helpers for messaging.
 * Used by both server-side publisher and client-side subscriber.
 */

export function conversationChannel(conversationId: string): string {
  return `private-conversation.${conversationId}`;
}

export function userChannel(userId: string): string {
  return `private-user.${userId}`;
}

export const MESSAGING_EVENTS = {
  NEW_MESSAGE: 'message',
  TYPING: 'typing',
  READ_RECEIPT: 'read',
} as const;

export type MessagingEvent = typeof MESSAGING_EVENTS[keyof typeof MESSAGING_EVENTS];
