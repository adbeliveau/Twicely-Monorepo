import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock DB
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {},
  channelProjection: {},
  auditEvent: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
  sellerChannel: vi.fn((id: string) => `private-user.${id}`),
}));

vi.mock('../../queue/emergency-delist-queue', () => ({
  emergencyDelistQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bq-delist-1' }),
  },
}));

vi.mock('@twicely/finance/post-off-platform-sale', () => ({
  postOffPlatformSale: vi.fn().mockResolvedValue(undefined),
}));

// --- Fixtures ---
const BASE_SALE = {
  listingId: 'lst-1',
  projectionId: 'proj-ebay',
  channel: 'EBAY' as const,
  externalOrderId: 'order-abc-123',
  salePriceCents: 5000,
  platformFeeCents: 645,
  soldAt: new Date('2026-01-15T10:00:00Z'),
};

const ACTIVE_PROJECTION = { id: 'proj-ebay', status: 'ACTIVE' };
const ACTIVE_LISTING = {
  id: 'lst-1',
  status: 'ACTIVE',
  ownerUserId: 'seller-1',
  title: 'Nike Air Jordan',
};
const SECOND_PROJECTION = { id: 'proj-posh', channel: 'POSHMARK' };

/** Helper: set up sequential select call results on the mocked db */
function setupSelectSequence(dbMock: unknown, results: unknown[][]): void {
  const db = dbMock as { select: Mock };
  let callCount = 0;
  db.select.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const idx = callCount++;
        const result = results[idx] ?? [];
        const resolvedPromise = Promise.resolve(result);
        // Support both: awaiting `.where()` directly (Drizzle returns thenable) and `.where().limit()`
        return Object.assign(resolvedPromise, {
          limit: vi.fn().mockResolvedValue(result),
        });
      }),
    }),
  }));
}

function setupUpdateMock(dbMock: unknown): void {
  const db = dbMock as { update: Mock };
  db.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

function setupInsertMock(dbMock: unknown): void {
  const db = dbMock as { insert: Mock };
  db.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
  });
}

describe('handleDetectedSale — notifications and edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies seller when sale is detected', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { notify } = await import('@/lib/notifications/service');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(notify).toHaveBeenCalledWith(
      'seller-1',
      'crosslister.sale_detected',
      expect.objectContaining({
        channel: 'EBAY',
        itemTitle: 'Nike Air Jordan',
      }),
    );
  });

  it('emits sale.detected Centrifugo event on channel private-user.{sellerId}', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { publishToChannel } = await import('@twicely/realtime/centrifugo-publisher');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(publishToChannel).toHaveBeenCalledWith(
      'private-user.seller-1',
      expect.objectContaining({
        event: 'sale.detected',
        listingId: 'lst-1',
        channel: 'EBAY',
        salePriceCents: 5000,
      }),
    );
  });

  it('creates no delist jobs when listing has no other projections', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [],
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(emergencyDelistQueue.add).not.toHaveBeenCalled();
  });

  it('calculates eBay platform fee at 12.9% correctly', async () => {
    const { calculatePlatformFee } = await import('@/lib/crosslister/services/platform-fees');
    const fee = calculatePlatformFee(10000, 1290);
    expect(fee).toBe(1290);
  });

  it('calculates Poshmark platform fee at 20% correctly', async () => {
    const { calculatePlatformFee } = await import('@/lib/crosslister/services/platform-fees');
    const fee = calculatePlatformFee(5000, 2000);
    expect(fee).toBe(1000);
  });

  it('gracefully skips when projection not found', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [],
    ]);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');

    await expect(handleDetectedSale(BASE_SALE)).resolves.toBeUndefined();
    expect(emergencyDelistQueue.add).not.toHaveBeenCalled();
  });

  it('stores soldPriceCents as integer cents (not float)', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock; insert: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [],
    ]);

    const setCalls: Record<string, unknown>[] = [];
    dbAny.update.mockReturnValue({
      set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        setCalls.push(data);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    });
    setupInsertMock(db);

    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale({ ...BASE_SALE, salePriceCents: 4999 });

    const soldPriceCall = setCalls.find((d) => d['soldPriceCents'] !== undefined);
    expect(soldPriceCall?.['soldPriceCents']).toBe(4999);
    expect(Number.isInteger(soldPriceCall?.['soldPriceCents'])).toBe(true);
  });

  it('double-sell does NOT create new delist jobs (delists already running from first sale)', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [{ ...ACTIVE_LISTING, status: 'SOLD' }],
      [{ channel: 'POSHMARK' }],
    ]);
    setupInsertMock(db);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(emergencyDelistQueue.add).not.toHaveBeenCalled();
  });
});
