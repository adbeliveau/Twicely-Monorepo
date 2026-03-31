import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', deletionRequestedAt: 'deletion_requested_at', email: 'email' },
  address: { userId: 'user_id' },
  taxInfo: { userId: 'user_id' },
  auditEvent: {},
  listing: { id: 'id', ownerUserId: 'owner_user_id' },
  listingImage: { listingId: 'listing_id', url: 'url' },
  dataExportRequest: { userId: 'user_id' },
  crosslisterAccount: { sellerId: 'seller_id' },
  order: { id: 'id', sellerId: 'seller_id', buyerId: 'buyer_id', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
  isNotNull: vi.fn((col) => ({ op: 'isNotNull', col })),
  inArray: vi.fn((col, arr) => ({ op: 'inArray', col, arr })),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(30),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/storage/image-service', () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../gdpr-pseudonymize', () => ({
  generatePseudonym: vi.fn(() => 'deleted_user_' + 'b'.repeat(64)),
  pseudonymizeOrders: vi.fn().mockResolvedValue(0),
  pseudonymizeLedgerEntries: vi.fn().mockResolvedValue(0),
  pseudonymizePayouts: vi.fn().mockResolvedValue(0),
  pseudonymizeMessages: vi.fn().mockResolvedValue(0),
  pseudonymizeAuditEvents: vi.fn().mockResolvedValue(0),
  pseudonymizeAffiliateRecords: vi.fn().mockResolvedValue(0),
}));

function makeSelectChain(value: unknown) {
  const resolved = Promise.resolve(value);
  const chain: {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: typeof resolved.then;
    catch: typeof resolved.catch;
    finally: typeof resolved.finally;
  } = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(value),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue({ ...chain, then: resolved.then.bind(resolved) });
  chain.limit.mockReturnValue(resolved);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue({ count: 1 }),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue({ count: 1 }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

import type { db as DbType } from '@twicely/db';

/** Helper: full mock setup for a user that has no blockers. */
function setupFullDeletionMocks(
  db: typeof DbType,
  userId: string
) {
  let n = 0;
  vi.mocked(db.select).mockImplementation(() => {
    n++;
    // call 1: candidates query → user found
    if (n === 1) return makeSelectChain([{ id: userId }]) as unknown as ReturnType<typeof db.select>;
    // call 2: hasBlockers seller orders → none
    if (n === 2) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    // call 3: hasBlockers buyer orders → none
    if (n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    // call 4: fetch targetUser for email
    if (n === 4) return makeSelectChain([{ id: userId, email: `${userId}@example.com` }]) as unknown as ReturnType<typeof db.select>;
    // call 5: userListings (for R2 image deletion) → no listings
    return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
  });
  vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
  vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
  vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);
}

describe('runAccountDeletionBatch — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('skips users with open buyer orders (both buy-side and sell-side blockers checked)', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');

    // Variant: seller orders empty, buyer orders non-empty → still blocked
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([{ id: 'user-buyer-blocked' }]) as unknown as ReturnType<typeof db.select>;
      }
      if (selectCallCount === 2) {
        // hasBlockers: seller side — no open seller orders
        return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      }
      // hasBlockers: buyer side — has open buyer order
      return makeSelectChain([{ id: 'order-buyer-open' }]) as unknown as ReturnType<typeof db.select>;
    });

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(logger.warn).toHaveBeenCalledWith(
      '[deletionExecutor] Skipping user with open orders',
      expect.objectContaining({ userId: 'user-buyer-blocked' })
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('handles user with no orders/listings/messages gracefully (no-data user)', async () => {
    const { db } = await import('@twicely/db');

    setupFullDeletionMocks(db, 'user-empty-data');

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await expect(runAccountDeletionBatch()).resolves.not.toThrow();

    // Should still update user and create audit event even with no data
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('is idempotent: processing already-pseudonymized user does not re-pseudonymize', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizeOrders } = await import('../gdpr-pseudonymize');

    // First run
    setupFullDeletionMocks(db, 'user-idempotent-1');
    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    const firstRunCallCount = vi.mocked(pseudonymizeOrders).mock.calls.length;

    // Reset mocks — second run: candidates query returns empty (user already processed)
    vi.clearAllMocks();
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    await runAccountDeletionBatch();

    // No additional pseudonymizeOrders calls on second run (user not in queue)
    expect(vi.mocked(pseudonymizeOrders).mock.calls.length).toBe(0);
    expect(firstRunCallCount).toBe(1);
  });

  it('logs info about Typesense removal being skipped (not yet wired)', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');

    setupFullDeletionMocks(db, 'user-typesense-log');

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(logger.info).toHaveBeenCalledWith(
      '[deletionExecutor] Typesense removal skipped (not yet wired)',
      expect.objectContaining({ userId: 'user-typesense-log' })
    );
  });

  it('skips processing when user is not found in DB', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-ghost' }]) as unknown as ReturnType<typeof db.select>;
      // hasBlockers: no open orders on either side
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      // targetUser lookup: user not found
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(logger.warn).toHaveBeenCalledWith(
      '[deletionExecutor] User not found',
      expect.objectContaining({ userId: 'user-ghost' })
    );
    expect(db.update).not.toHaveBeenCalled();
  });
});
