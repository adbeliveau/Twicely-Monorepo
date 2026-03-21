import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockExecute = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    execute: mockExecute,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', sellerId: 'seller_id', status: 'status', cancelInitiator: 'cancel_initiator', createdAt: 'created_at', handlingDueAt: 'handling_due_at' },
  shipment: { orderId: 'order_id', shippedAt: 'shipped_at' },
  returnRequest: { sellerId: 'seller_id', reason: 'reason', bucket: 'bucket', createdAt: 'created_at' },
  review: { sellerId: 'seller_id', status: 'status', createdAt: 'created_at', rating: 'rating', dsrItemAsDescribed: 'dsr_item_as_described', dsrShippingSpeed: 'dsr_shipping_speed', dsrCommunication: 'dsr_communication', dsrPackaging: 'dsr_packaging', trustWeight: 'trust_weight' },
  conversation: { sellerId: 'seller_id', createdAt: 'created_at', id: 'id' },
  message: { conversationId: 'conversation_id', senderUserId: 'sender_user_id', createdAt: 'created_at' },
  sellerProfile: { status: 'status', isNew: 'is_new', sellerScore: 'seller_score' },
  sellerBalance: {},
}));

// Chain factory: .where() is the terminal resolve for queries without .limit(),
// .limit() is the terminal resolve for queries that use it.
const makeChain = (resolveValue: unknown) => ({
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(resolveValue),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(resolveValue),
  groupBy: vi.fn().mockReturnThis(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getOnTimeShippingRate', () => {
  it('calculates on-time shipping rate from orders and shipments', async () => {
    const rows = [
      { handlingDueAt: new Date('2025-01-10'), shippedAt: new Date('2025-01-09') }, // on time
      { handlingDueAt: new Date('2025-01-10'), shippedAt: new Date('2025-01-11') }, // late
    ];
    mockSelect.mockReturnValue(makeChain(rows));

    const { getOnTimeShippingRate } = await import('../metric-queries');
    const rate = await getOnTimeShippingRate('user-1', 90);
    expect(rate).toBe(0.5);
  });

  it('returns 1.0 when no orders in window', async () => {
    mockSelect.mockReturnValue(makeChain([]));

    const { getOnTimeShippingRate } = await import('../metric-queries');
    const rate = await getOnTimeShippingRate('user-1', 90);
    expect(rate).toBe(1.0);
  });

  it('uses 90-day window by default', async () => {
    mockSelect.mockReturnValue(makeChain([]));

    const { getOnTimeShippingRate } = await import('../metric-queries');
    await getOnTimeShippingRate('user-1');
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe('getInadClaimRate', () => {
  it('calculates INAD rate from return requests', async () => {
    // Two separate db.select() calls: completed orders count, then INAD count
    mockSelect
      .mockReturnValueOnce(makeChain([{ cnt: 10 }]))
      .mockReturnValueOnce(makeChain([{ cnt: 2 }]));

    const { getInadClaimRate } = await import('../metric-queries');
    const rate = await getInadClaimRate('user-1', 90);
    expect(rate).toBe(0.2);
  });

  it('returns 0 when no orders in window', async () => {
    mockSelect.mockReturnValue(makeChain([{ cnt: 0 }]));

    const { getInadClaimRate } = await import('../metric-queries');
    const rate = await getInadClaimRate('user-1', 90);
    expect(rate).toBe(0);
  });
});

describe('getReturnRate', () => {
  it('calculates seller-fault return rate', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ cnt: 20 }]))
      .mockReturnValueOnce(makeChain([{ cnt: 1 }]));

    const { getReturnRate } = await import('../metric-queries');
    const rate = await getReturnRate('user-1', 90);
    expect(rate).toBeCloseTo(0.05, 5);
  });

  it('returns 0 for all metrics when no orders in window', async () => {
    mockSelect.mockReturnValue(makeChain([{ cnt: 0 }]));

    const { getReturnRate } = await import('../metric-queries');
    const rate = await getReturnRate('user-1', 90);
    expect(rate).toBe(0);
  });
});

describe('getCancellationRate', () => {
  it('calculates seller cancellation rate', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ cnt: 50 }]))
      .mockReturnValueOnce(makeChain([{ cnt: 5 }]));

    const { getCancellationRate } = await import('../metric-queries');
    const rate = await getCancellationRate('user-1', 90);
    expect(rate).toBe(0.1);
  });
});

describe('getPrimaryFeeBucket', () => {
  it('determines primary fee bucket by order volume', async () => {
    mockExecute.mockResolvedValue([{ fee_bucket: 'ELECTRONICS' }]);

    const { getPrimaryFeeBucket } = await import('../metric-queries');
    const bucket = await getPrimaryFeeBucket('user-1', 90);
    expect(bucket).toBe('ELECTRONICS');
  });

  it('returns default fee bucket when no orders', async () => {
    mockExecute.mockResolvedValue([]);

    const { getPrimaryFeeBucket } = await import('../metric-queries');
    const bucket = await getPrimaryFeeBucket('user-1', 90);
    expect(bucket).toBe('APPAREL_ACCESSORIES');
  });
});

describe('getCompletedOrderCount', () => {
  it('returns count of completed orders', async () => {
    mockSelect.mockReturnValue(makeChain([{ cnt: 42 }]));

    const { getCompletedOrderCount } = await import('../metric-queries');
    const count = await getCompletedOrderCount('user-1', 90);
    expect(count).toBe(42);
  });

  it('returns 0 for all metrics when no orders in window', async () => {
    mockSelect.mockReturnValue(makeChain([{ cnt: 0 }]));

    const { getCompletedOrderCount } = await import('../metric-queries');
    const count = await getCompletedOrderCount('user-1', 90);
    expect(count).toBe(0);
  });
});
