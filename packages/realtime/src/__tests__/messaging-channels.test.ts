/**
 * Tests for messaging-channels.ts
 */
import { describe, it, expect } from 'vitest';
import { conversationChannel, userChannel, MESSAGING_EVENTS } from '../messaging-channels';

describe('conversationChannel', () => {
  it('returns correct format with private-conversation. prefix', () => {
    expect(conversationChannel('conv-abc-123')).toBe('private-conversation.conv-abc-123');
  });

  it('includes the conversationId exactly', () => {
    const id = 'clxyz1234567890';
    expect(conversationChannel(id)).toBe(`private-conversation.${id}`);
  });
});

describe('userChannel', () => {
  it('returns correct format with private-user. prefix', () => {
    expect(userChannel('user-abc-123')).toBe('private-user.user-abc-123');
  });

  it('includes the userId exactly', () => {
    const id = 'cluser987654321';
    expect(userChannel(id)).toBe(`private-user.${id}`);
  });
});

describe('MESSAGING_EVENTS', () => {
  it('NEW_MESSAGE is "message"', () => {
    expect(MESSAGING_EVENTS.NEW_MESSAGE).toBe('message');
  });

  it('TYPING is "typing"', () => {
    expect(MESSAGING_EVENTS.TYPING).toBe('typing');
  });

  it('READ_RECEIPT is "read"', () => {
    expect(MESSAGING_EVENTS.READ_RECEIPT).toBe('read');
  });

  it('has exactly 3 event types', () => {
    expect(Object.keys(MESSAGING_EVENTS)).toHaveLength(3);
  });
});
