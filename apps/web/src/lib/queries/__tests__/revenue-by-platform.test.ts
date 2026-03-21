/**
 * Tests for getRevenueByPlatform — cross-platform revenue aggregation.
 * Source: F5-S2 install prompt §4 (test requirements)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: {
    userId: 'user_id',
    channel: 'channel',
    type: 'type',
    amountCents: 'amount_cents',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
  gte: vi.fn((col: unknown, val: unknown) => ({ gte: { col, val } })),
  lte: vi.fn((col: unknown, val: unknown) => ({ lte: { col, val } })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: { col, vals } })),
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join('?'), vals })),
}));

// Chainable query mock that resolves to rows when awaited
function createQueryChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const k of ['from', 'where', 'groupBy', 'orderBy']) {
    chain[k] = (..._args: unknown[]) => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(rows);
  return chain;
}

const START = new Date('2026-01-01');
const END = new Date('2026-03-31');

describe('getRevenueByPlatform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when there are no ledger entries', async () => {
    const { db } = await import('@/lib/db');
    (db as unknown as { select: Mock }).select.mockReturnValue(createQueryChain([]));

    const { getRevenueByPlatform } = await import('../revenue-by-platform');
    const result = await getRevenueByPlatform('user-1', START, END);

    expect(result).toEqual([]);
  });

  it('returns one TWICELY row when only Twicely sales exist', async () => {
    const { db } = await import('@/lib/db');
    const rows = [
      { channel: 'TWICELY', type: 'ORDER_PAYMENT_CAPTURED', total: 10000, cnt: 2 },
      { channel: 'TWICELY', type: 'ORDER_TF_FEE', total: -1000, cnt: 2 },
    ];
    (db as unknown as { select: Mock }).select.mockReturnValue(createQueryChain(rows));

    const { getRevenueByPlatform } = await import('../revenue-by-platform');
    const result = await getRevenueByPlatform('user-1', START, END);

    expect(result.length).toBe(1);
    expect(result[0]!.channel).toBe('TWICELY');
    expect(result[0]!.revenueCents).toBe(10000);
    expect(result[0]!.orderCount).toBe(2);
  });

  it('returns separate rows for each platform with correct revenue and fees', async () => {
    const { db } = await import('@/lib/db');
    const rows = [
      { channel: 'TWICELY', type: 'ORDER_PAYMENT_CAPTURED', total: 8000, cnt: 1 },
      { channel: 'TWICELY', type: 'ORDER_TF_FEE', total: -800, cnt: 1 },
      { channel: 'EBAY', type: 'CROSSLISTER_SALE_REVENUE', total: 5000, cnt: 1 },
      { channel: 'EBAY', type: 'CROSSLISTER_PLATFORM_FEE', total: -645, cnt: 1 },
      { channel: 'POSHMARK', type: 'CROSSLISTER_SALE_REVENUE', total: 3000, cnt: 1 },
      { channel: 'POSHMARK', type: 'CROSSLISTER_PLATFORM_FEE', total: -600, cnt: 1 },
    ];
    (db as unknown as { select: Mock }).select.mockReturnValue(createQueryChain(rows));

    const { getRevenueByPlatform } = await import('../revenue-by-platform');
    const result = await getRevenueByPlatform('user-1', START, END);

    expect(result.length).toBe(3);

    const twicely = result.find((r) => r.channel === 'TWICELY');
    expect(twicely?.revenueCents).toBe(8000);
    expect(twicely?.feesCents).toBe(800);

    const ebay = result.find((r) => r.channel === 'EBAY');
    expect(ebay?.revenueCents).toBe(5000);
    expect(ebay?.feesCents).toBe(645);

    const posh = result.find((r) => r.channel === 'POSHMARK');
    expect(posh?.revenueCents).toBe(3000);
    expect(posh?.feesCents).toBe(600);
  });

  it('date range filter is applied (query uses startDate and endDate)', async () => {
    const { db } = await import('@/lib/db');
    const { gte, lte } = await import('drizzle-orm');

    (db as unknown as { select: Mock }).select.mockReturnValue(createQueryChain([]));

    const { getRevenueByPlatform } = await import('../revenue-by-platform');
    await getRevenueByPlatform('user-1', START, END);

    expect(gte).toHaveBeenCalledWith(expect.anything(), START);
    expect(lte).toHaveBeenCalledWith(expect.anything(), END);
  });

  it('net calculation equals revenue minus fees', async () => {
    const { db } = await import('@/lib/db');
    const rows = [
      { channel: 'EBAY', type: 'CROSSLISTER_SALE_REVENUE', total: 5000, cnt: 1 },
      { channel: 'EBAY', type: 'CROSSLISTER_PLATFORM_FEE', total: -645, cnt: 1 },
    ];
    (db as unknown as { select: Mock }).select.mockReturnValue(createQueryChain(rows));

    const { getRevenueByPlatform } = await import('../revenue-by-platform');
    const result = await getRevenueByPlatform('user-1', START, END);

    const ebay = result.find((r) => r.channel === 'EBAY');
    expect(ebay?.netCents).toBe(5000 - 645);
    expect(ebay?.netCents).toBe(ebay!.revenueCents - ebay!.feesCents);
  });
});
