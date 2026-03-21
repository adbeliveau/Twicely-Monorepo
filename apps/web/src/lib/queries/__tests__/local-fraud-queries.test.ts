import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localFraudFlag: {
    id: 'id',
    sellerId: 'seller_id',
    listingId: 'listing_id',
    localTransactionId: 'local_transaction_id',
    trigger: 'trigger',
    severity: 'severity',
    status: 'status',
    createdAt: 'created_at',
    resolvedAt: 'resolved_at',
    updatedAt: 'updated_at',
  },
  localTransaction: { id: 'id', status: 'status' },
  listing: { id: 'id', title: 'title' },
  user: { id: 'id', name: 'name' },
}));

import { db } from '@twicely/db';
import {
  getLocalFraudFlags,
  getLocalFraudFlagById,
  getSellerFraudHistory,
} from '../local-fraud';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SELLER_ID = 'seller-001';
const FLAG_ID = 'flag-001';

function makeQueryChain(resolvedValue: unknown) {
  const chain = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function makeCountChain(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn();
  const chain = { from, where };
  from.mockReturnValue(chain);
  return chain;
}

// Terminal at .limit() — for getLocalFraudFlagById
function makeLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// Terminal at .orderBy() — for getSellerFraudHistory
function makeOrderByChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const mockDbSelect = vi.mocked(db.select);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getLocalFraudFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated results with correct joins', async () => {
    const flagRows = [
      {
        id: FLAG_ID,
        sellerId: SELLER_ID,
        sellerName: 'Jordan S.',
        listingId: 'lst-001',
        listingTitle: 'Air Jordans',
        localTransactionId: 'lt-001',
        localTransactionStatus: 'NO_SHOW',
        trigger: 'NOSHOW_RELIST',
        severity: 'STRONG_SIGNAL',
        status: 'OPEN',
        createdAt: new Date(),
        resolvedAt: null,
      },
    ];

    mockDbSelect
      .mockReturnValueOnce(makeCountChain(1) as never)
      .mockReturnValueOnce(makeQueryChain(flagRows) as never);

    const result = await getLocalFraudFlags(1, 20);

    expect(result.flags).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('filters by status when statusFilter is provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeCountChain(0) as never)
      .mockReturnValueOnce(makeQueryChain([]) as never);

    const result = await getLocalFraudFlags(1, 10, 'OPEN');

    expect(result.flags).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('returns empty results for page 2 with no data', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeCountChain(0) as never)
      .mockReturnValueOnce(makeQueryChain([]) as never);

    const result = await getLocalFraudFlags(2, 10);

    expect(result.flags).toHaveLength(0);
    expect(result.page).toBe(2);
  });
});

describe('getLocalFraudFlagById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns flag when found', async () => {
    const flag = { id: FLAG_ID, sellerId: SELLER_ID, status: 'OPEN' };
    mockDbSelect.mockReturnValueOnce(makeLimitChain([flag]) as never);

    const result = await getLocalFraudFlagById(FLAG_ID);

    expect(result).toEqual(flag);
  });

  it('returns null when flag not found', async () => {
    mockDbSelect.mockReturnValueOnce(makeLimitChain([]) as never);

    const result = await getLocalFraudFlagById(FLAG_ID);

    expect(result).toBeNull();
  });
});

describe('getSellerFraudHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all flags for a given seller', async () => {
    const flags = [
      { id: FLAG_ID, sellerId: SELLER_ID, status: 'CONFIRMED' },
      { id: 'flag-002', sellerId: SELLER_ID, status: 'OPEN' },
    ];

    mockDbSelect.mockReturnValueOnce(makeOrderByChain(flags) as never);

    const result = await getSellerFraudHistory(SELLER_ID);

    expect(Array.isArray(result)).toBe(true);
  });
});
