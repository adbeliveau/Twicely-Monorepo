import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', orderNumber: 'order_number', status: 'status',
    totalCents: 'total_cents', createdAt: 'created_at',
    buyerId: 'buyer_id', sellerId: 'seller_id',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  or: vi.fn((...args) => ({ op: 'or', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  sql: Object.assign(
    (tpl: TemplateStringsArray) => ({ sql: tpl[0], as: (a: string) => ({ sql: tpl[0], alias: a }) }),
    { as: vi.fn(), join: vi.fn() }
  ),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
}));
vi.mock('../order-helpers', () => ({
  fetchOrderItemSummaries: vi.fn(),
}));

import { getBuyerOrders } from '../orders-buyer';
import { db } from '@twicely/db';
import { fetchOrderItemSummaries } from '../order-helpers';

const mockSelect = vi.mocked(db.select);
const mockFetchSummaries = vi.mocked(fetchOrderItemSummaries);

const BUYER_ID = 'buyer-test-001';

const baseOrder = {
  orderId: 'ord-1', orderNumber: 'TW-0001', status: 'PAID',
  totalCents: 4999, createdAt: new Date('2025-01-01'),
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

function makeItemSummaries(orderId: string, listingId: string) {
  return {
    firstItemMap: new Map([[orderId, { title: 'Nike Shoes', listingId }]]),
    itemCountMap: new Map([[orderId, 2]]),
    imageMap: new Map([[listingId, 'https://cdn.example.com/img.jpg']]),
  };
}

describe('getBuyerOrders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty result when buyer has no orders', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    const result = await getBuyerOrders(BUYER_ID);
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(0);
  });

  it('returns paginated orders for a buyer', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue(makeItemSummaries('ord-1', 'lst-1'));

    const result = await getBuyerOrders(BUYER_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.orderId).toBe('ord-1');
    expect(result.items[0]!.firstItemTitle).toBe('Nike Shoes');
    expect(result.items[0]!.itemCount).toBe(2);
    expect(result.items[0]!.firstItemThumbnail).toBe('https://cdn.example.com/img.jpg');
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('defaults thumbnail to null when image not found', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map([['ord-1', { title: 'Item', listingId: 'lst-no-img' }]]),
      itemCountMap: new Map([['ord-1', 1]]),
      imageMap: new Map(),
    });

    const result = await getBuyerOrders(BUYER_ID);
    expect(result.items[0]!.firstItemThumbnail).toBeNull();
  });

  it('calculates correct total pages', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 45 }]) as never)
      .mockReturnValueOnce(makeChain(Array(20).fill(baseOrder).map((o, i) => ({ ...o, orderId: `ord-${i}` }))) as never);
    mockFetchSummaries.mockResolvedValue({
      firstItemMap: new Map(
        Array.from({ length: 20 }, (_, i) => [`ord-${i}`, { title: 'T', listingId: `lst-${i}` }])
      ),
      itemCountMap: new Map(Array.from({ length: 20 }, (_, i) => [`ord-${i}`, 1])),
      imageMap: new Map(),
    });

    const result = await getBuyerOrders(BUYER_ID, { page: 1, pageSize: 20 });
    expect(result.totalPages).toBe(3);
  });

  it('accepts status=ACTIVE filter', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([baseOrder]) as never);
    mockFetchSummaries.mockResolvedValue(makeItemSummaries('ord-1', 'lst-1'));

    const result = await getBuyerOrders(BUYER_ID, { status: 'ACTIVE' });
    expect(result.items).toHaveLength(1);
  });

  it('accepts status=COMPLETED filter', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([{ ...baseOrder, status: 'COMPLETED' }]) as never);
    mockFetchSummaries.mockResolvedValue(makeItemSummaries('ord-1', 'lst-1'));

    const result = await getBuyerOrders(BUYER_ID, { status: 'COMPLETED' });
    expect(result.items[0]!.status).toBe('COMPLETED');
  });

  it('accepts status=CANCELED filter', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(makeChain([{ ...baseOrder, status: 'CANCELED' }]) as never);
    mockFetchSummaries.mockResolvedValue(makeItemSummaries('ord-1', 'lst-1'));

    const result = await getBuyerOrders(BUYER_ID, { status: 'CANCELED' });
    expect(result.items[0]!.status).toBe('CANCELED');
  });

  it('skips fetchOrderItemSummaries when no orders returned', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeChain([]) as never);

    await getBuyerOrders(BUYER_ID);
    expect(mockFetchSummaries).not.toHaveBeenCalled();
  });
});
