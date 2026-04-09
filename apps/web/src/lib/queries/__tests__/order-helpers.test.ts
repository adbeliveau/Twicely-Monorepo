import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  orderItem: { orderId: 'order_id', title: 'title', listingId: 'listing_id' },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
}));

import { fetchOrderItemSummaries } from '../order-helpers';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('fetchOrderItemSummaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty maps immediately for empty orderIds', async () => {
    const result = await fetchOrderItemSummaries([]);
    expect(result.firstItemMap.size).toBe(0);
    expect(result.itemCountMap.size).toBe(0);
    expect(result.imageMap.size).toBe(0);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns firstItemMap with first item per order', async () => {
    // items query
    mockSelect.mockReturnValueOnce(makeChain([
      { orderId: 'ord-1', title: 'Nike Air Jordan', listingId: 'lst-1' },
      { orderId: 'ord-1', title: 'Second Item', listingId: 'lst-2' },
      { orderId: 'ord-2', title: 'Vintage Coat', listingId: 'lst-3' },
    ]) as never);
    // images query
    mockSelect.mockReturnValueOnce(makeChain([
      { listingId: 'lst-1', url: 'https://cdn.example.com/1.jpg' },
      { listingId: 'lst-3', url: 'https://cdn.example.com/3.jpg' },
    ]) as never);

    const result = await fetchOrderItemSummaries(['ord-1', 'ord-2']);
    // First item for ord-1 should be the FIRST item encountered (lst-1)
    expect(result.firstItemMap.get('ord-1')).toEqual({ title: 'Nike Air Jordan', listingId: 'lst-1' });
    expect(result.firstItemMap.get('ord-2')).toEqual({ title: 'Vintage Coat', listingId: 'lst-3' });
  });

  it('returns correct itemCountMap with per-order counts', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { orderId: 'ord-1', title: 'Item A', listingId: 'lst-a' },
      { orderId: 'ord-1', title: 'Item B', listingId: 'lst-b' },
      { orderId: 'ord-1', title: 'Item C', listingId: 'lst-c' },
      { orderId: 'ord-2', title: 'Item D', listingId: 'lst-d' },
    ]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await fetchOrderItemSummaries(['ord-1', 'ord-2']);
    expect(result.itemCountMap.get('ord-1')).toBe(3);
    expect(result.itemCountMap.get('ord-2')).toBe(1);
  });

  it('returns imageMap keyed by listingId', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { orderId: 'ord-1', title: 'Item', listingId: 'lst-1' },
    ]) as never);
    mockSelect.mockReturnValueOnce(makeChain([
      { listingId: 'lst-1', url: 'https://cdn.example.com/thumb.jpg' },
    ]) as never);

    const result = await fetchOrderItemSummaries(['ord-1']);
    expect(result.imageMap.get('lst-1')).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('skips images query when all items have no listing IDs', async () => {
    // Items query returns empty (no items found)
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await fetchOrderItemSummaries(['ord-empty']);
    expect(result.imageMap.size).toBe(0);
    // Images query should not be fired because firstItemMap is empty
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('handles single order with single item correctly', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { orderId: 'ord-solo', title: 'Solo Item', listingId: 'lst-solo' },
    ]) as never);
    mockSelect.mockReturnValueOnce(makeChain([
      { listingId: 'lst-solo', url: 'https://cdn.example.com/solo.jpg' },
    ]) as never);

    const result = await fetchOrderItemSummaries(['ord-solo']);
    expect(result.firstItemMap.size).toBe(1);
    expect(result.itemCountMap.get('ord-solo')).toBe(1);
    expect(result.imageMap.get('lst-solo')).toBe('https://cdn.example.com/solo.jpg');
  });
});
