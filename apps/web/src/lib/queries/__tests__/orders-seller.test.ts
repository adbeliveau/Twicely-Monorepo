import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', orderNumber: 'order_number', status: 'status',
    totalCents: 'total_cents', createdAt: 'created_at',
    buyerId: 'buyer_id', sellerId: 'seller_id',
    expectedShipByAt: 'expected_ship_by_at', isLateShipment: 'is_late_shipment',
  },
  user: { id: 'id', name: 'name' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  or: vi.fn((...args) => ({ op: 'or', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0] }),
    { as: vi.fn(), join: vi.fn() }
  ),
}));
vi.mock('../order-helpers', () => ({
  fetchOrderItemSummaries: vi.fn(),
}));

import { getSellerOrders } from '../orders-seller';
import { db } from '@twicely/db';
import { fetchOrderItemSummaries } from '../order-helpers';

const mockSelect = vi.mocked(db.select);
const mockFetchSummaries = vi.mocked(fetchOrderItemSummaries);

const SELLER_ID = 'seller-test-001';

const baseOrder = {
  orderId: 'ord-1', orderNumber: 'TW-0001', status: 'PAID',
  totalCents: 4999, createdAt: new Date('2025-01-01'),
  buyerId: 'buyer-001', expectedShipByAt: null, isLateShipment: false,
};

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockReturnValue(chain);
  chain['offset'] = vi.fn().mockResolvedValue(data);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getSellerOrders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty result when seller has no orders', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const result = await getSellerOrders(SELLER_ID);
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('returns orders with buyer name for a seller', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map([['ord-1', { title: 'Vintage Coat', listingId: 'lst-1' }]]),
      itemCountMap: new Map([['ord-1', 1]]),
      imageMap: new Map([['lst-1', 'https://cdn.example.com/coat.jpg']]),
    });
    // buyer query
    mockSelect.mockReturnValueOnce(makeChain([{ userId: 'buyer-001', name: 'Jane Smith' }]) as never);

    const result = await getSellerOrders(SELLER_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.buyerName).toBe('Jane Smith');
    expect(result.items[0]!.firstItemTitle).toBe('Vintage Coat');
    expect(result.items[0]!.status).toBe('PAID');
  });

  it('defaults buyerName to Unknown when buyer not in DB', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map([['ord-1', { title: 'Item', listingId: 'lst-1' }]]),
      itemCountMap: new Map([['ord-1', 1]]),
      imageMap: new Map(),
    });
    // buyer query returns empty
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getSellerOrders(SELLER_ID);
    expect(result.items[0]!.buyerName).toBe('Unknown');
  });

  it('includes isLateShipment and expectedShipByAt in result', async () => {
    const shipByDate = new Date('2025-01-05');
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([{ ...baseOrder, isLateShipment: true, expectedShipByAt: shipByDate }]) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map([['ord-1', { title: 'Item', listingId: 'lst-1' }]]),
      itemCountMap: new Map([['ord-1', 1]]),
      imageMap: new Map(),
    });
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getSellerOrders(SELLER_ID);
    expect(result.items[0]!.isLateShipment).toBe(true);
    expect(result.items[0]!.expectedShipByAt).toEqual(shipByDate);
  });

  it('respects AWAITING_SHIPMENT status filter', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map([['ord-1', { title: 'Item', listingId: 'lst-1' }]]),
      itemCountMap: new Map([['ord-1', 1]]),
      imageMap: new Map(),
    });
    mockSelect.mockReturnValueOnce(makeChain([{ userId: 'buyer-001', name: 'Bob' }]) as never);

    const result = await getSellerOrders(SELLER_ID, { status: 'AWAITING_SHIPMENT' });
    expect(result.items).toHaveLength(1);
  });

  it('calculates correct pagination metadata', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 60 }]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const result = await getSellerOrders(SELLER_ID, { page: 2, pageSize: 20 });
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
  });
});
