import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ args, type: 'and' })),
  or: vi.fn((...args: unknown[]) => ({ args, type: 'or' })),
  inArray: vi.fn((col, vals) => ({ col, vals, type: 'inArray' })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    type: 'sql',
  })),
  desc: vi.fn((col) => ({ col, type: 'desc' })),
  asc: vi.fn((col) => ({ col, type: 'asc' })),
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    orderId: 'order_id',
    buyerId: 'buyer_id',
    sellerId: 'seller_id',
    status: 'status',
    scheduledAt: 'scheduled_at',
    confirmedAt: 'confirmed_at',
    meetupLocationId: 'meetup_location_id',
  },
  safeMeetupLocation: {
    id: 'id',
    name: 'name',
    city: 'city',
    state: 'state',
    isActive: 'is_active',
    meetupCount: 'meetup_count',
    latitude: 'latitude',
    longitude: 'longitude',
  },
}));

const BUYER_ID = 'buyer-user-001';
const SELLER_ID = 'seller-user-001';
const TX_ID = 'tx-local-001';

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    orderId: 'order-001',
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status: 'SCHEDULED',
    scheduledAt: new Date(),
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loc-001',
    name: 'Police Station 1st Precinct',
    city: 'Austin',
    state: 'TX',
    isActive: true,
    meetupCount: 10,
    latitude: 30.27,
    longitude: -97.74,
    ...overrides,
  };
}

// ─── Local Transaction Queries ────────────────────────────────────────────────

describe('local transaction queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('getLocalTransactionByOrderId returns transaction with meetup location', async () => {
    const tx = makeTx();
    const loc = makeLocation();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { local_transaction: tx, safe_meetup_location: loc },
            ]),
          }),
        }),
      }),
    });

    const { getLocalTransactionByOrderId } = await import('../local-transaction');
    const result = await getLocalTransactionByOrderId('order-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe(TX_ID);
    expect(result?.meetupLocation).not.toBeNull();
    expect(result?.meetupLocation?.id).toBe('loc-001');
  });

  it('getLocalTransactionById returns transaction', async () => {
    const tx = makeTx();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([tx]),
        }),
      }),
    });

    const { getLocalTransactionById } = await import('../local-transaction');
    const result = await getLocalTransactionById(TX_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(TX_ID);
  });

  it('getLocalTransactionById returns null when not found', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { getLocalTransactionById } = await import('../local-transaction');
    const result = await getLocalTransactionById('nonexistent');

    expect(result).toBeNull();
  });

  it('getActiveLocalTransactionsForUser returns upcoming meetups for user', async () => {
    const txs = [makeTx({ status: 'SCHEDULED' }), makeTx({ id: 'tx-2', status: 'SELLER_CHECKED_IN' })];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(txs),
        }),
      }),
    });

    const { getActiveLocalTransactionsForUser } = await import('../local-transaction');
    const result = await getActiveLocalTransactionsForUser(BUYER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]?.status).toBe('SCHEDULED');
  });

  it('getCompletedLocalTransactionsForUser returns completed meetups', async () => {
    const txs = [makeTx({ status: 'COMPLETED', confirmedAt: new Date() })];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(txs),
          }),
        }),
      }),
    });

    const { getCompletedLocalTransactionsForUser } = await import('../local-transaction');
    const result = await getCompletedLocalTransactionsForUser(SELLER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('COMPLETED');
  });
});

// ─── Safe Meetup Location Queries ────────────────────────────────────────────

describe('safe meetup location queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('getActiveSafeMeetupLocations returns only active locations', async () => {
    const locations = [makeLocation(), makeLocation({ id: 'loc-002', name: 'Community Center' })];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(locations),
        }),
      }),
    });

    const { getActiveSafeMeetupLocations } = await import('../safe-meetup-locations');
    const result = await getActiveSafeMeetupLocations();

    expect(result).toHaveLength(2);
  });

  it('getActiveSafeMeetupLocations filters by city/state', async () => {
    const locations = [makeLocation()];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(locations),
        }),
      }),
    });

    const { getActiveSafeMeetupLocations } = await import('../safe-meetup-locations');
    const result = await getActiveSafeMeetupLocations('Austin', 'TX');

    expect(result).toHaveLength(1);
    expect(result[0]?.city).toBe('Austin');
  });

  it('getSafeMeetupLocationById returns location', async () => {
    const loc = makeLocation();
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([loc]),
        }),
      }),
    });

    const { getSafeMeetupLocationById } = await import('../safe-meetup-locations');
    const result = await getSafeMeetupLocationById('loc-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('loc-001');
  });

  it('getNearbyMeetupLocations returns locations within radius', async () => {
    const rows = [{ ...makeLocation(), distanceMiles: 3.5 }];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });

    const { getNearbyMeetupLocations } = await import('../safe-meetup-locations');
    const result = await getNearbyMeetupLocations(30.27, -97.74, 10);

    expect(result).toHaveLength(1);
    expect(result[0]?.distanceMiles).toBe(3.5);
  });

  it('getNearbyMeetupLocations orders by distance', async () => {
    const rows = [
      { ...makeLocation(), distanceMiles: 1.2 },
      { ...makeLocation({ id: 'loc-002' }), distanceMiles: 5.0 },
    ];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });

    const { getNearbyMeetupLocations } = await import('../safe-meetup-locations');
    const result = await getNearbyMeetupLocations(30.27, -97.74, 10);

    expect(result[0]?.distanceMiles).toBe(1.2);
    expect(result[1]?.distanceMiles).toBe(5.0);
  });
});
