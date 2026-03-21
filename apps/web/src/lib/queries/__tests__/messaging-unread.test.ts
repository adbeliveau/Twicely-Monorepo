/**
 * Tests for messaging.ts queries — getUnreadCount, getConversationForListing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockSelect = db.select as Mock;

// ─── Chain Helpers ────────────────────────────────────────────────────────────

/**
 * For queries that call .from().where() and are awaited directly (sum aggregation).
 */
function makeWhereTerminalChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
      }),
    }),
  };
}

/**
 * For getConversationForListing which ends at .from().where().limit()
 */
function makeLimitChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-test-001';
const LISTING_ID = 'listing-test-001';
const CONV_ID = 'conv-test-001';

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct buyer and seller unread counts with non-zero totals', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '5' }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '3' }]) as never);

    const { getUnreadCount } = await import('../messaging');
    const result = await getUnreadCount(BUYER_ID);

    expect(result.buyerUnread).toBe(5);
    expect(result.sellerUnread).toBe(3);
    expect(result.total).toBe(8);
  });

  it('returns zeros when user has no unread messages', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '0' }]) as never);

    const { getUnreadCount } = await import('../messaging');
    const result = await getUnreadCount('user-no-messages');

    expect(result.buyerUnread).toBe(0);
    expect(result.sellerUnread).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles null total from DB (no conversations) — defaults to zero', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: null }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: null }]) as never);

    const { getUnreadCount } = await import('../messaging');
    const result = await getUnreadCount('brand-new-user');

    expect(result.buyerUnread).toBe(0);
    expect(result.sellerUnread).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles empty row array from DB — defaults to zero', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([]) as never);

    const { getUnreadCount } = await import('../messaging');
    const result = await getUnreadCount('user-no-rows');

    expect(result.buyerUnread).toBe(0);
    expect(result.sellerUnread).toBe(0);
    expect(result.total).toBe(0);
  });

  it('total is sum of buyerUnread and sellerUnread', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '7' }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '4' }]) as never);

    const { getUnreadCount } = await import('../messaging');
    const result = await getUnreadCount(BUYER_ID);

    expect(result.total).toBe(result.buyerUnread + result.sellerUnread);
  });

  it('makes exactly 2 db.select() calls — one for buyer, one for seller', async () => {
    mockSelect
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '0' }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: '0' }]) as never);

    const { getUnreadCount } = await import('../messaging');
    await getUnreadCount(BUYER_ID);

    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});

// ─── getConversationForListing ────────────────────────────────────────────────

describe('getConversationForListing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conversation ID when an OPEN conversation exists', async () => {
    mockSelect.mockReturnValueOnce(
      makeLimitChain([{ id: CONV_ID, status: 'OPEN' }]) as never
    );

    const { getConversationForListing } = await import('../messaging');
    const result = await getConversationForListing(LISTING_ID, BUYER_ID);

    expect(result).toBe(CONV_ID);
  });

  it('returns null when no conversation exists for this listing-buyer pair', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { getConversationForListing } = await import('../messaging');
    const result = await getConversationForListing(LISTING_ID, 'buyer-no-conv');

    expect(result).toBeNull();
  });

  it('returns null when conversation is ARCHIVED (not OPEN)', async () => {
    mockSelect.mockReturnValueOnce(
      makeLimitChain([{ id: CONV_ID, status: 'ARCHIVED' }]) as never
    );

    const { getConversationForListing } = await import('../messaging');
    const result = await getConversationForListing(LISTING_ID, BUYER_ID);

    expect(result).toBeNull();
  });

  it('returns null when conversation is READ_ONLY (not OPEN)', async () => {
    mockSelect.mockReturnValueOnce(
      makeLimitChain([{ id: CONV_ID, status: 'READ_ONLY' }]) as never
    );

    const { getConversationForListing } = await import('../messaging');
    const result = await getConversationForListing(LISTING_ID, BUYER_ID);

    expect(result).toBeNull();
  });

  it('makes exactly 1 db.select() call', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { getConversationForListing } = await import('../messaging');
    await getConversationForListing(LISTING_ID, BUYER_ID);

    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
