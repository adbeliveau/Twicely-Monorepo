import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), selectDistinct: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', hasAutomation: 'has_automation' },
  automationSetting: { sellerId: 'seller_id', priceDropEnabled: 'price_drop_enabled', priceDropPercent: 'price_drop_percent', priceDropIntervalDays: 'price_drop_interval_days', priceDropFloorPercent: 'price_drop_floor_percent' },
  channelProjection: { listingId: 'listing_id', sellerId: 'seller_id', status: 'status', id: 'id', accountId: 'account_id', channel: 'channel' },
  crossJob: { sellerId: 'seller_id', payload: 'payload', createdAt: 'created_at', idempotencyKey: 'idempotency_key', id: 'id' },
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', priceCents: 'price_cents', updatedAt: 'updated_at' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(vi.fn((s: TemplateStringsArray) => s[0]), { raw: vi.fn() }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/crosslister/services/automation-meter', () => ({
  canPerformAutomationAction: vi.fn(),
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { db } from '@twicely/db';
import { canPerformAutomationAction } from '@twicely/crosslister/services/automation-meter';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { runPriceDropEngine } from '../price-drop-engine';

const mockSelect = vi.mocked(db.select);
const mockSelectDistinct = vi.mocked(db.selectDistinct);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockCanPerform = vi.mocked(canPerformAutomationAction);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain as unknown as ReturnType<typeof db.select>;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.update>;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.insert>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetPlatformSetting.mockResolvedValue(true); // default: platform enabled
});

describe('runPriceDropEngine', () => {
  it('skips sellers without priceDropEnabled', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));
    await runPriceDropEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('drops price by configured percent', async () => {
    // sellers
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 10, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    // listings (selectDistinct)
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 10000 }]) as never);
    // last drop → none (no previous drop)
    mockSelect.mockReturnValueOnce(makeChain([]));
    // idempotency check → none
    mockSelect.mockReturnValueOnce(makeChain([]));
    // projections for listing
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'proj1', accountId: 'acc1', channel: 'EBAY' }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockUpdate.mockReturnValue(makeUpdateChain());
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();

    expect(mockUpdate).toHaveBeenCalled(); // canonical price updated
    expect(mockInsert).toHaveBeenCalled();
    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'UPDATE',
        priority: 700,
        payload: expect.objectContaining({
          automationEngine: 'PRICE_DROP',
          newPriceCents: 9000, // 10000 * 0.90
          oldPriceCents: 10000,
        }),
      })
    );
  });

  it('enforces floor — skips if already at or below floor price', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 10, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    // listing at floor: priceCents = 5000, originalPriceCents = 10000, floor = 5000
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 5000 }]) as never);
    // last drop shows originalPriceCents = 10000
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'job1', createdAt: new Date(0), payload: { originalPriceCents: 10000, automationEngine: 'PRICE_DROP' } }]));
    // idempotency → none
    mockSelect.mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();
    expect(mockInsert).not.toHaveBeenCalled(); // at floor, should skip
  });

  it('respects interval — skips if last drop was too recent', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 10, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 10000 }]) as never);
    // last drop: recent (within interval)
    const recentDrop = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'job1', createdAt: recentDrop, payload: { originalPriceCents: 10000 } }]));
    // idempotency → none
    mockSelect.mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('stops when action limit reached', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 10, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 10000 }]) as never);

    mockCanPerform
      .mockResolvedValueOnce({ allowed: true, used: 2000, limit: 2000, remaining: 0 })
      .mockResolvedValueOnce({ allowed: false, used: 2000, limit: 2000, remaining: 0 });

    await runPriceDropEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates UPDATE crossJob with correct payload shape', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 5, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 20000 }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]));
    mockSelect.mockReturnValueOnce(makeChain([]));
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'proj1', accountId: 'acc1', channel: 'MERCARI' }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockUpdate.mockReturnValue(makeUpdateChain());
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'UPDATE',
        payload: expect.objectContaining({ automationEngine: 'PRICE_DROP' }),
      })
    );
  });

  it('skips projection when platform automation is disabled', async () => {
    mockGetPlatformSetting.mockResolvedValue(false); // platform disabled

    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 10, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 10000 }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([])); // no last drop
    mockSelect.mockReturnValueOnce(makeChain([])); // no idempotency match
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'proj1', accountId: 'acc1', channel: 'EBAY' }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockUpdate.mockReturnValue(makeUpdateChain());
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates crossJob with maxAttempts=2', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{
      userId: 'user1', priceDropPercent: 5, priceDropIntervalDays: 14, priceDropFloorPercent: 50,
    }]));
    mockSelectDistinct.mockReturnValueOnce(makeChain([{ listingId: 'l1', priceCents: 20000 }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]));
    mockSelect.mockReturnValueOnce(makeChain([]));
    mockSelect.mockReturnValueOnce(makeChain([{ id: 'proj1', accountId: 'acc1', channel: 'MERCARI' }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockUpdate.mockReturnValue(makeUpdateChain());
    mockInsert.mockReturnValue(makeInsertChain());

    await runPriceDropEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 2 })
    );
  });
});
