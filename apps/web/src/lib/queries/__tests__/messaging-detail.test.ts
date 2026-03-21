/**
 * Tests for getConversationMessages() — otherPartyName/Id/Image fields.
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

const BUYER_ID = 'buyer-detail-001';
const SELLER_ID = 'seller-detail-002';
const CONV_ID = 'conv-detail-001';
const NOW = new Date('2026-01-15T12:00:00Z');

const convRow = {
  id: CONV_ID,
  listingId: 'listing-detail-001',
  orderId: null,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  subject: 'Detail test',
  status: 'OPEN',
  isFlagged: false,
  createdAt: NOW,
  listingTitle: 'Test Item',
  listingSlug: 'test-item-abc',
  listingPriceCents: 2500,
  listingImageUrl: null,
};

const sellerRow = { name: 'Bob Seller', image: 'https://cdn.example.com/bob.jpg' };
const buyerRow = { name: 'Alice Buyer', image: null };

describe('getConversationMessages — otherParty fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('otherPartyName returns seller name when viewer is buyer', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([convRow]) as never)
      .mockReturnValueOnce(makeChain([sellerRow]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const { getConversationMessages } = await import('../messaging');
    const result = await getConversationMessages(CONV_ID, BUYER_ID);

    expect(result).not.toBeNull();
    expect(result?.conversation.otherPartyName).toBe('Bob Seller');
    expect(result?.conversation.otherPartyId).toBe(SELLER_ID);
  });

  it('otherPartyName returns buyer name when viewer is seller', async () => {
    const convAsSeller = { ...convRow, buyerId: BUYER_ID, sellerId: SELLER_ID };
    mockSelect
      .mockReturnValueOnce(makeChain([convAsSeller]) as never)
      .mockReturnValueOnce(makeChain([buyerRow]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const { getConversationMessages } = await import('../messaging');
    const result = await getConversationMessages(CONV_ID, SELLER_ID);

    expect(result).not.toBeNull();
    expect(result?.conversation.otherPartyName).toBe('Alice Buyer');
    expect(result?.conversation.otherPartyId).toBe(BUYER_ID);
  });

  it('otherPartyImage can be null when user has no profile image', async () => {
    const buyerRowNoImg = { name: 'Alice Buyer', image: null };
    mockSelect
      .mockReturnValueOnce(makeChain([convRow]) as never)
      .mockReturnValueOnce(makeChain([buyerRowNoImg]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const { getConversationMessages } = await import('../messaging');
    const result = await getConversationMessages(CONV_ID, SELLER_ID);

    expect(result?.conversation.otherPartyImage).toBeNull();
  });

  it('otherPartyName falls back to "Unknown" when user row not found', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([convRow]) as never)
      .mockReturnValueOnce(makeChain([]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const { getConversationMessages } = await import('../messaging');
    const result = await getConversationMessages(CONV_ID, BUYER_ID);

    expect(result?.conversation.otherPartyName).toBe('Unknown');
    expect(result?.conversation.otherPartyImage).toBeNull();
  });
});
