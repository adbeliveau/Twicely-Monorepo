import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'user_id', hasAutomation: 'has_automation' },
  automationSetting: { sellerId: 'seller_id', autoRelistEnabled: 'auto_relist_enabled', autoRelistDays: 'auto_relist_days', autoRelistChannels: 'auto_relist_channels' },
  channelProjection: { sellerId: 'seller_id', status: 'status', createdAt: 'created_at', channel: 'channel', id: 'id', listingId: 'listing_id', accountId: 'account_id' },
  crossJob: { sellerId: 'seller_id', id: 'id', idempotencyKey: 'idempotency_key' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  lt: vi.fn((a, b) => ({ type: 'lt', a, b })),
  inArray: vi.fn((a, b) => ({ type: 'inArray', a, b })),
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
import { runAutoRelistEngine } from '../auto-relist-engine';

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
  mockGetConnector.mockReturnValue({ capabilities: { canAutoRelist: true } } as never);
  mockGetPlatformSetting.mockResolvedValue(true); // default: platform enabled
});

describe('runAutoRelistEngine', () => {
  it('finds eligible sellers and creates RELIST jobs', async () => {
    // sellers query
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      // canPerformAutomationAction → allowed
      // projections query
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      // idempotency check → no existing
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 5, limit: 2000, remaining: 1995 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();

    expect(mockInsert).toHaveBeenCalled();
  });

  it('skips sellers without hasAutomation', async () => {
    mockSelect.mockReturnValueOnce(makeChain([])); // no sellers
    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips when automation action limit is reached', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]));

    // First call: allowed. Second call (per projection): not allowed
    mockCanPerform
      .mockResolvedValueOnce({ allowed: true, used: 2000, limit: 2000, remaining: 0 })
      .mockResolvedValueOnce({ allowed: false, used: 2000, limit: 2000, remaining: 0 });

    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates crossJob with jobType=RELIST and priority=700', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();

    const insertCall = mockInsert.mock.calls[0];
    const insertValues = vi.mocked(mockInsert.mock.results[0]!.value as ReturnType<typeof db.insert>).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'RELIST',
        priority: 700,
        payload: expect.objectContaining({ automationEngine: 'AUTO_RELIST' }),
      })
    );
    expect(insertCall).toBeDefined();
  });

  it('skips projection if idempotency key already exists', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([{ id: 'existing-job' }])); // existing idempotency key

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips connector without canAutoRelist capability', async () => {
    mockGetConnector.mockReturnValue({ capabilities: { canAutoRelist: false } } as never);

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'POSHMARK' }]))
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('respects channel filter from autoRelistChannels', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: ['EBAY'] }]))
      .mockReturnValueOnce(makeChain([])) // no eligible projections for the filtered channel
      ;

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });

    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips seller with autoRelistEnabled false (not returned from query)', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));
    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('stops creating jobs mid-loop when limit reached', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([
        { id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' },
        { id: 'proj2', listingId: 'l2', accountId: 'acc1', channel: 'EBAY' },
      ]))
      .mockReturnValueOnce(makeChain([])) // idempotency proj1 → none
      .mockReturnValueOnce(makeChain([])); // idempotency proj2 → checked

    mockCanPerform
      .mockResolvedValueOnce({ allowed: true, used: 0, limit: 2000, remaining: 2000 }) // seller check
      .mockResolvedValueOnce({ allowed: true, used: 1999, limit: 2000, remaining: 1 }) // proj1 check → allowed
      .mockResolvedValueOnce({ allowed: false, used: 2000, limit: 2000, remaining: 0 }); // proj2 check → denied

    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();
    expect(mockInsert).toHaveBeenCalledTimes(1); // only proj1
  });

  it('skips projection when platform automation is disabled', async () => {
    mockGetPlatformSetting.mockResolvedValue(false); // platform disabled

    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates crossJob with maxAttempts=2', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ userId: 'user1', autoRelistDays: 30, autoRelistChannels: [] }]))
      .mockReturnValueOnce(makeChain([{ id: 'proj1', listingId: 'l1', accountId: 'acc1', channel: 'EBAY' }]))
      .mockReturnValueOnce(makeChain([]));

    mockCanPerform.mockResolvedValue({ allowed: true, used: 0, limit: 2000, remaining: 2000 });
    mockInsert.mockReturnValue(makeInsertChain());

    await runAutoRelistEngine();

    const insertValues = vi.mocked((mockInsert.mock.results[0]?.value as ReturnType<typeof db.insert>)).values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 2 })
    );
  });
});
