/**
 * Tests for messaging-helpers.ts — isParticipant, getRateLimitPerHour,
 * getMessageCountLastHour, fetchConversation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

// ─── Chain Helpers ────────────────────────────────────────────────────────────

/** For queries that end with .from().where().limit() */
function makeLimitChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

/** For queries that end with .from().where() returning thenable */
function makeWhereChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-test-001';
const SELLER_ID = 'seller-test-002';
const CONV_ID = 'cuid2convaaaaaaaa';

const OPEN_CONV = {
  id: CONV_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  status: 'OPEN' as const,
  buyerUnreadCount: 0,
  sellerUnreadCount: 0,
};

// ─── isParticipant ────────────────────────────────────────────────────────────

describe('isParticipant', () => {
  it('returns true for the buyer', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, BUYER_ID, null)).toBe(true);
  });

  it('returns true for the seller', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, SELLER_ID, null)).toBe(true);
  });

  it('returns false for an outsider with no delegation', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, 'outsider-999', null)).toBe(false);
  });

  it('returns true for delegated staff acting on behalf of seller', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, 'staff-user-999', SELLER_ID)).toBe(true);
  });

  it('returns false for delegated staff acting on behalf of a different seller', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, 'staff-user-999', 'different-seller-888')).toBe(false);
  });

  it('returns false when onBehalfOfSellerId is null and userId does not match', async () => {
    const { isParticipant } = await import('../messaging-helpers');
    expect(isParticipant(OPEN_CONV, 'no-match-user', null)).toBe(false);
  });
});

// ─── getRateLimitPerHour ──────────────────────────────────────────────────────

describe('getRateLimitPerHour', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns numeric value from platform_settings', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ value: 30 }]) as never);

    const { getRateLimitPerHour } = await import('../messaging-helpers');
    const result = await getRateLimitPerHour();

    expect(result).toBe(30);
  });

  it('returns default 30 when no platform setting row is found', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { getRateLimitPerHour } = await import('../messaging-helpers');
    const result = await getRateLimitPerHour();

    expect(result).toBe(30);
  });

  it('returns default 30 when value is not a number (string from JSON)', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ value: '30' }]) as never);

    const { getRateLimitPerHour } = await import('../messaging-helpers');
    const result = await getRateLimitPerHour();

    expect(result).toBe(30);
  });

  it('returns default 30 when value is null', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([{ value: null }]) as never);

    const { getRateLimitPerHour } = await import('../messaging-helpers');
    const result = await getRateLimitPerHour();

    expect(result).toBe(30);
  });
});

// ─── getMessageCountLastHour ──────────────────────────────────────────────────

describe('getMessageCountLastHour', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the count from DB for a user with recent messages', async () => {
    mockDbSelect.mockReturnValueOnce(makeWhereChain([{ count: 7 }]) as never);

    const { getMessageCountLastHour } = await import('../messaging-helpers');
    const result = await getMessageCountLastHour(BUYER_ID);

    expect(result).toBe(7);
  });

  it('returns 0 when user has no messages in the last hour', async () => {
    mockDbSelect.mockReturnValueOnce(makeWhereChain([{ count: 0 }]) as never);

    const { getMessageCountLastHour } = await import('../messaging-helpers');
    const result = await getMessageCountLastHour(BUYER_ID);

    expect(result).toBe(0);
  });

  it('returns 0 when DB returns empty array (new user, no messages)', async () => {
    mockDbSelect.mockReturnValueOnce(makeWhereChain([]) as never);

    const { getMessageCountLastHour } = await import('../messaging-helpers');
    const result = await getMessageCountLastHour('brand-new-user');

    expect(result).toBe(0);
  });

  it('returns count at the rate limit boundary (exactly 20)', async () => {
    mockDbSelect.mockReturnValueOnce(makeWhereChain([{ count: 20 }]) as never);

    const { getMessageCountLastHour } = await import('../messaging-helpers');
    const result = await getMessageCountLastHour(BUYER_ID);

    expect(result).toBe(20);
  });
});

// ─── fetchConversation ────────────────────────────────────────────────────────

describe('fetchConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conversation row when conversation exists', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([OPEN_CONV]) as never);

    const { fetchConversation } = await import('../messaging-helpers');
    const result = await fetchConversation(CONV_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(CONV_ID);
    expect(result?.buyerId).toBe(BUYER_ID);
    expect(result?.sellerId).toBe(SELLER_ID);
    expect(result?.status).toBe('OPEN');
  });

  it('returns null when conversation does not exist', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const { fetchConversation } = await import('../messaging-helpers');
    const result = await fetchConversation('nonexistent-conv');

    expect(result).toBeNull();
  });

  it('returns correct unread counts', async () => {
    const conv = { ...OPEN_CONV, buyerUnreadCount: 3, sellerUnreadCount: 1 };
    mockDbSelect.mockReturnValueOnce(makeLimitChain([conv]) as never);

    const { fetchConversation } = await import('../messaging-helpers');
    const result = await fetchConversation(CONV_ID);

    expect(result?.buyerUnreadCount).toBe(3);
    expect(result?.sellerUnreadCount).toBe(1);
  });

  it('returns ARCHIVED conversation (no status filter)', async () => {
    const archived = { ...OPEN_CONV, status: 'ARCHIVED' as const };
    mockDbSelect.mockReturnValueOnce(makeLimitChain([archived]) as never);

    const { fetchConversation } = await import('../messaging-helpers');
    const result = await fetchConversation(CONV_ID);

    expect(result?.status).toBe('ARCHIVED');
  });

  it('makes exactly 1 db.select() call', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([OPEN_CONV]) as never);

    const { fetchConversation } = await import('../messaging-helpers');
    await fetchConversation(CONV_ID);

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });
});
