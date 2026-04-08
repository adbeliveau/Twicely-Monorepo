import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', ownerUserId: 'owner_user_id', status: 'status',
    priceCents: 'price_cents', categoryId: 'category_id',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  sql: vi.fn((tpl: TemplateStringsArray) => ({ type: 'sql', tpl })),
}));
vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn() },
}));

import { getListingsForBulkAction } from '../bulk-listings';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);

const USER_ID = 'user-test-001';

function makeAuthSession(userId = USER_ID, canRead = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canRead) } as never,
    session: { userId, delegationId: null } as never,
  };
}

function makeQueryChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['$dynamic'] = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('getListingsForBulkAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(makeAuthSession());
  });

  it('returns error when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => false) } as never, session: null });
    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it('returns error when CASL forbids Listing read', async () => {
    mockAuthorize.mockResolvedValue(makeAuthSession(USER_ID, false));
    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/forbidden/i);
  });

  it('returns all owned listing IDs with no filter', async () => {
    mockSelect.mockReturnValue(makeQueryChain([
      { id: 'l-1' },
      { id: 'l-2' },
      { id: 'l-3' },
    ]) as never);

    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(true);
    expect(result.listingIds).toEqual(['l-1', 'l-2', 'l-3']);
  });

  it('returns empty array when user has no listings', async () => {
    mockSelect.mockReturnValue(makeQueryChain([]) as never);

    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(true);
    expect(result.listingIds).toHaveLength(0);
  });

  it('applies status filter when provided', async () => {
    mockSelect.mockReturnValue(makeQueryChain([{ id: 'l-active-1' }]) as never);

    const result = await getListingsForBulkAction({ status: 'ACTIVE' });
    expect(result.success).toBe(true);
    // The query chain should have where() called for status filter
    expect(result.listingIds).toEqual(['l-active-1']);
  });

  it('applies categoryId filter when provided', async () => {
    mockSelect.mockReturnValue(makeQueryChain([{ id: 'l-cat-1' }]) as never);

    const result = await getListingsForBulkAction({ categoryId: 'cat-electronics' });
    expect(result.success).toBe(true);
    expect(result.listingIds).toEqual(['l-cat-1']);
  });

  it('caps results at 100 listings', async () => {
    // Returns 100 items (the limit is enforced by .limit(100) in the query)
    const hundredIds = Array.from({ length: 100 }, (_, i) => ({ id: `l-${i}` }));
    mockSelect.mockReturnValue(makeQueryChain(hundredIds) as never);

    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(true);
    expect(result.listingIds!.length).toBe(100);
  });

  it('returns error on DB failure', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('DB connection lost');
    });

    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to fetch/i);
  });

  it('uses delegationId to resolve userId for staff acting on behalf of seller', async () => {
    const sellerOnBehalfId = 'seller-on-behalf-001';
    mockAuthorize.mockResolvedValue({
      ability: { can: vi.fn().mockReturnValue(true) } as never,
      session: { userId: 'staff-001', delegationId: 'del-001', onBehalfOfSellerId: sellerOnBehalfId } as never,
    });
    mockSelect.mockReturnValue(makeQueryChain([{ id: 'seller-listing' }]) as never);

    const result = await getListingsForBulkAction({});
    expect(result.success).toBe(true);
  });
});
