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

vi.mock('../gdpr-pseudonymize', () => ({
  generatePseudonym: vi.fn(() => 'deleted_user_' + 'a'.repeat(64)),
  pseudonymizeOrders: vi.fn().mockResolvedValue(2),
  pseudonymizeLedgerEntries: vi.fn().mockResolvedValue(5),
  pseudonymizePayouts: vi.fn().mockResolvedValue(1),
  pseudonymizeMessages: vi.fn().mockResolvedValue(3),
  pseudonymizeAuditEvents: vi.fn().mockResolvedValue(7),
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

describe('runAccountDeletionBatch — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads gracePeriodDays from platform settings', async () => {
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(getPlatformSetting).toHaveBeenCalledWith('gdpr.deletionGracePeriodDays', 30);
  });

  it('skips users still in cooling-off period', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('skips users with open orders', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');

    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return makeSelectChain([{ id: 'user-blocked' }]) as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([{ id: 'order-1' }]) as unknown as ReturnType<typeof db.select>;
    });

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(logger.warn).toHaveBeenCalledWith(
      '[deletionExecutor] Skipping user with open orders',
      expect.objectContaining({ userId: 'user-blocked' })
    );
  });

  it('sends confirmation email before clearing PII', async () => {
    const { db } = await import('@twicely/db');
    const { notify } = await import('@twicely/notifications/service');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-1' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-1', email: 'victim@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(notify).toHaveBeenCalledWith('user-del-1', 'privacy.deletion_completed', {});
  });

  it('pseudonymizes order buyer/seller IDs', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizeOrders } = await import('../gdpr-pseudonymize');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-2' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-2', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(pseudonymizeOrders).toHaveBeenCalledWith('user-del-2', expect.stringMatching(/^deleted_user_/));
  });

  it('pseudonymizes ledger entry userIds', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizeLedgerEntries } = await import('../gdpr-pseudonymize');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-3' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-3', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(pseudonymizeLedgerEntries).toHaveBeenCalledWith('user-del-3', expect.stringMatching(/^deleted_user_/));
  });

  it('pseudonymizes payout ownerIds', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizePayouts } = await import('../gdpr-pseudonymize');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-4' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-4', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(pseudonymizePayouts).toHaveBeenCalledWith('user-del-4', expect.stringMatching(/^deleted_user_/));
  });
});
