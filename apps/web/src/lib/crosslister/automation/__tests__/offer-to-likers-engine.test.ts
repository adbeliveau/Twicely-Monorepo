import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', hasAutomation: 'has_automation' },
  automationSetting: { sellerId: 'seller_id', offerToLikersEnabled: 'offer_to_likers_enabled', offerDiscountPercent: 'offer_discount_percent', offerMinDaysListed: 'offer_min_days_listed' },
  channelProjection: { sellerId: 'seller_id', status: 'status', createdAt: 'created_at', id: 'id', listingId: 'listing_id', accountId: 'account_id', channel: 'channel' },
  crossJob: { sellerId: 'seller_id', payload: 'payload', createdAt: 'created_at', id: 'id', idempotencyKey: 'idempotency_key' },
  listing: { id: 'id', status: 'status', priceCents: 'price_cents' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  lt: vi.fn((a, b) => ({ type: 'lt', a, b })),
  sql: Object.assign(vi.fn((s: TemplateStringsArray) => s[0]), { raw: vi.fn() }),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/crosslister/services/automation-meter', () => ({
  canPerformAutomationAction: vi.fn(),
}));
vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn(),
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { db } from '@twicely/db';
import { canPerformAutomationAction } from '@twicely/crosslister/services/automation-meter';
import { getConnector } from '@twicely/crosslister/connector-registry';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { runOfferToLikersEngine } from '../offer-to-likers-engine';

const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockCanPerform = vi.mocked(canPerformAutomationAction);
const mockGetConnector = vi.mocked(getConnector);
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

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain as unknown as ReturnType<typeof db.insert>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetConnector.mockReturnValue({ capabilities: { canMakeOffers: true } } as never);
  mockGetPlatformSetting.mockResolvedValue(true); // default: platform enabled
});

describe('runOfferToLikersEngine', () => {
  it('creates SYNC jobs for eligible listings', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([])) // last offer: none
      .mockReturnValueOnce(makeChain([{ priceCents: 5000 }])); // listing price

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();
    expect(mockInsert).toHaveBeenCalled();
    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'SYNC',
        priority: 700,
        payload: expect.objectContaining({
          automationEngine: 'OFFER_TO_LIKERS',
          offerPriceCents: 4500, // 5000 * 0.90
          discountPercent: 10,
        }),
      })
    );
  });

  it('respects 7-day cooldown between offers for same projection', async () => {
    const recentOffer = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([{ id: 'job1', createdAt: recentOffer }])); // recent offer

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips when ConnectorCapabilities.canMakeOffers is false', async () => {
    mockGetConnector.mockReturnValue({ capabilities: { canMakeOffers: false } } as never);

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'MERCARI' }]))
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('stops when automation action limit reached', async () => {
    mockSelect.mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]));
    mockCanPerform.mockResolvedValue({ allowed: false, used: 2000, limit: 2000, remaining: 0 });

    await runOfferToLikersEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips sellers without offerToLikersEnabled', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));
    await runOfferToLikersEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('calculates offer price as integer cents', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 15, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ priceCents: 3333 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    // 3333 * (85 / 100) = 3333 * 0.85 ≈ 2833.05 → Math.round → 2833
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ offerPriceCents: 2833 }) })
    );
  });

  it('skips projection when platform automation is disabled', async () => {
    mockGetPlatformSetting.mockResolvedValue(false); // platform disabled

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([])); // no last offer

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates crossJob with maxAttempts=2', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'u1', offerDiscountPercent: 10, offerMinDaysListed: 7 }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ priceCents: 5000 }]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runOfferToLikersEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 2 })
    );
  });
});
