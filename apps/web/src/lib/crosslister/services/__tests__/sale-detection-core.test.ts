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

describe('handleDetectedSale — core status updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks listing status SOLD when sale is detected', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock; insert: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
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
    await handleDetectedSale(BASE_SALE);

    const soldCall = setCalls.find((d) => d['status'] === 'SOLD' && d['soldPriceCents'] !== undefined);
    expect(soldCall).toBeDefined();
    expect(soldCall?.['status']).toBe('SOLD');
  });

  it('marks selling projection status SOLD', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock; insert: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
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
    await handleDetectedSale(BASE_SALE);

    // Both listing and projection updates should be SOLD
    const soldUpdates = setCalls.filter((d) => d['status'] === 'SOLD');
    expect(soldUpdates.length).toBeGreaterThanOrEqual(2);
  });

  it('creates emergency delist jobs for other ACTIVE projections', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(emergencyDelistQueue.add).toHaveBeenCalledWith(
      'emergency-delist',
      expect.objectContaining({
        projectionId: 'proj-posh',
        listingId: 'lst-1',
        channel: 'POSHMARK',
        reason: 'SALE_DETECTED',
        sourceChannel: 'EBAY',
        sourceSaleId: 'order-abc-123',
      }),
      expect.objectContaining({ priority: 0 }),
    );
  });

  it('does not create delist job for the sold projection itself', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [SECOND_PROJECTION],
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    const addCalls = (emergencyDelistQueue.add as Mock).mock.calls;
    const soldProjCalls = addCalls.filter((call: unknown[]) => {
      const data = call[1] as Record<string, unknown>;
      return data?.projectionId === 'proj-ebay';
    });
    expect(soldProjCalls.length).toBe(0);
  });

  it('does not create delist jobs when no other ACTIVE projections exist', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACTIVE_LISTING],
      [], // no other ACTIVE projections
    ]);
    setupUpdateMock(db);
    setupInsertMock(db);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(emergencyDelistQueue.add).not.toHaveBeenCalled();
  });

  it('is idempotent when projection is already SOLD (duplicate sale)', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock };

    setupSelectSequence(db, [
      [{ id: 'proj-ebay', status: 'SOLD' }],
    ]);

    const { emergencyDelistQueue } = await import('../../queue/emergency-delist-queue');
    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    expect(dbAny.update).not.toHaveBeenCalled();
    expect(emergencyDelistQueue.add).not.toHaveBeenCalled();
  });

  it('detects double-sell when listing is already SOLD', async () => {
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

  it('flags POTENTIAL_DOUBLE_SELL via audit event on double-sell', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { insert: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [{ ...ACTIVE_LISTING, status: 'SOLD' }],
      [{ channel: 'POSHMARK' }],
    ]);

    const insertCalls: unknown[] = [];
    dbAny.insert.mockReturnValue({
      values: vi.fn().mockImplementation((data: unknown) => {
        insertCalls.push(data);
        return Promise.resolve([{ id: 'event-2' }]);
      }),
    });

    const { handleDetectedSale } = await import('../sale-detection');
    await handleDetectedSale(BASE_SALE);

    const doubleCall = insertCalls.find((c) => {
      const data = c as Record<string, unknown>;
      return data?.['action'] === 'DOUBLE_SELL_DETECTED';
    });
    expect(doubleCall).toBeDefined();
  });
});
