/**
 * Tests for getConversations() inbox filtering and last-message preview.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockSelect = db.select as Mock;

function makeChain(rows: unknown[]) {
  const chainable: Record<string, unknown> = {};
  const methods = ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit'];
  for (const m of methods) {
    chainable[m] = vi.fn().mockImplementation(() => chainable);
  }
  (chainable.orderBy as Mock).mockResolvedValue(rows);
  (chainable.limit as Mock).mockResolvedValue(rows);
  return chainable;
}

const BUYER_ID = 'buyer-inbox-001';
const SELLER_ID = 'seller-inbox-002';
const CONV_ID = 'conv-inbox-001';
const NOW = new Date('2026-01-15T12:00:00Z');

const baseRow = {
  id: CONV_ID,
  listingId: 'listing-inbox-001',
  orderId: null,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  subject: 'Inbox test item',
  status: 'OPEN',
  lastMessageAt: NOW,
  buyerUnreadCount: 0,
  sellerUnreadCount: 0,
  createdAt: NOW,
  listingTitle: 'Test Item',
  listingSlug: 'test-item-abc',
  listingImageUrl: null,
  otherBuyerName: 'Alice Buyer',
  otherBuyerImage: null,
  otherSellerName: 'Bob Seller',
  otherSellerImage: null,
  lastMessageBody: 'Hello there!',
  lastMessageSenderUserId: BUYER_ID,
};

describe('getConversations — inbox filtering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('role=buyer filters to conversations where user is buyer', async () => {
    // The query filters by buyerId = userId in where clause
    // We verify the result maps correctly when the user is the buyer
    mockSelect.mockReturnValueOnce(makeChain([baseRow]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result).toHaveLength(1);
    expect(result[0]?.otherPartyId).toBe(SELLER_ID);
    expect(result[0]?.otherPartyName).toBe('Bob Seller');
  });

  it('role=seller filters to conversations where user is seller', async () => {
    const sellerRow = { ...baseRow, buyerId: BUYER_ID, sellerId: SELLER_ID };
    mockSelect.mockReturnValueOnce(makeChain([sellerRow]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(SELLER_ID, 'seller');

    expect(result).toHaveLength(1);
    expect(result[0]?.otherPartyId).toBe(BUYER_ID);
    expect(result[0]?.otherPartyName).toBe('Alice Buyer');
  });

  it('role=both returns all conversations for user', async () => {
    const buyerConv = { ...baseRow, id: 'conv-both-buyer', buyerId: BUYER_ID };
    const sellerConv = { ...baseRow, id: 'conv-both-seller', sellerId: BUYER_ID, buyerId: 'other-user' };
    mockSelect.mockReturnValueOnce(makeChain([buyerConv, sellerConv]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'both');

    expect(result).toHaveLength(2);
  });

  it('lastMessagePreview populated from latest message body', async () => {
    const rowWithMsg = { ...baseRow, lastMessageBody: 'Is this still available?' };
    mockSelect.mockReturnValueOnce(makeChain([rowWithMsg]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result[0]?.lastMessagePreview).toBe('Is this still available?');
  });

  it('lastMessagePreview null when no messages exist (new conversation)', async () => {
    const rowNoMsg = { ...baseRow, lastMessageBody: null, lastMessageSenderUserId: null };
    mockSelect.mockReturnValueOnce(makeChain([rowNoMsg]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result[0]?.lastMessagePreview).toBeNull();
  });

  it('lastMessageSenderIsMe true when userId matches last sender', async () => {
    const rowOwnMsg = { ...baseRow, lastMessageSenderUserId: BUYER_ID };
    mockSelect.mockReturnValueOnce(makeChain([rowOwnMsg]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result[0]?.lastMessageSenderIsMe).toBe(true);
  });

  it('lastMessageSenderIsMe false when other party sent last message', async () => {
    const rowOtherMsg = { ...baseRow, lastMessageSenderUserId: SELLER_ID };
    mockSelect.mockReturnValueOnce(makeChain([rowOtherMsg]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result[0]?.lastMessageSenderIsMe).toBe(false);
  });

  it('preview capped at 120 chars', async () => {
    const longBody = 'A'.repeat(200);
    const rowLong = { ...baseRow, lastMessageBody: longBody };
    mockSelect.mockReturnValueOnce(makeChain([rowLong]) as never);

    const { getConversations } = await import('../messaging');
    const result = await getConversations(BUYER_ID, 'buyer');

    expect(result[0]?.lastMessagePreview).toHaveLength(120);
    expect(result[0]?.lastMessagePreview).toBe('A'.repeat(120));
  });
});
