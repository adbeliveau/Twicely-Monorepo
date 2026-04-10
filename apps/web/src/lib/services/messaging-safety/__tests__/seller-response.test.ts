/**
 * Tests for messaging-safety/seller-response.ts
 * V4-15: Messaging Safety & Abuse Prevention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
};
Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));

const mockDb = {
  insert: vi.fn().mockReturnValue(mockChain),
  select: vi.fn().mockReturnValue(mockChain),
  update: vi.fn().mockReturnValue(mockChain),
};

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  sellerResponseMetric: {
    id: 'id',
    sellerId: 'seller_id',
    conversationId: 'conversation_id',
    firstBuyerMessageAt: 'first_buyer_message_at',
    firstSellerResponseAt: 'first_seller_response_at',
    responseTimeMinutes: 'response_time_minutes',
    createdAt: 'created_at',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  isNotNull: vi.fn(),
  avg: vi.fn(),
  count: vi.fn().mockReturnValue('count'),
  sql: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('recordBuyerMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.limit.mockResolvedValue([]);
    mockChain.values.mockResolvedValue([]);
  });

  it('creates a new metric row when none exists', async () => {
    mockChain.limit.mockResolvedValue([]);

    const { recordBuyerMessage } = await import('../seller-response');
    await recordBuyerMessage('seller-1', 'conv-1');

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('does not create a duplicate when metric already exists', async () => {
    mockChain.limit.mockResolvedValue([{ id: 'existing-1' }]);

    const { recordBuyerMessage } = await import('../seller-response');
    await recordBuyerMessage('seller-1', 'conv-1');

    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('recordSellerResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.limit.mockResolvedValue([]);
  });

  it('updates response time when first response is recorded', async () => {
    const buyerMessageAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    mockChain.limit.mockResolvedValue([{
      id: 'metric-1',
      firstBuyerMessageAt: buyerMessageAt,
      firstSellerResponseAt: null,
    }]);

    const { recordSellerResponse } = await import('../seller-response');
    await recordSellerResponse('seller-1', 'conv-1');

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('skips update when response was already recorded', async () => {
    mockChain.limit.mockResolvedValue([{
      id: 'metric-1',
      firstBuyerMessageAt: new Date(),
      firstSellerResponseAt: new Date(),
    }]);

    const { recordSellerResponse } = await import('../seller-response');
    await recordSellerResponse('seller-1', 'conv-1');

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe('getSellerResponseStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero stats when no conversations exist', async () => {
    // First query (total) returns 0
    mockChain.where.mockResolvedValueOnce([{ count: 0 }]);

    const { getSellerResponseStats } = await import('../seller-response');
    const result = await getSellerResponseStats('seller-1', 30);

    expect(result.totalConversations).toBe(0);
    expect(result.averageResponseMinutes).toBe(0);
    expect(result.responseRate).toBe(0);
  });
});
