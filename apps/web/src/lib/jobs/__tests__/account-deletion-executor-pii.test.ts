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
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
  isNotNull: vi.fn((col) => ({ op: 'isNotNull', col })),
  isNull: vi.fn((col) => ({ op: 'isNull', col })),
  inArray: vi.fn((col, arr) => ({ op: 'inArray', col, arr })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
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

vi.mock('@/lib/gdpr/pseudonymize', () => ({
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

describe('runAccountDeletionBatch — PII clearing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('pseudonymizes message senderIds', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizeMessages } = await import('@/lib/gdpr/pseudonymize');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-5' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-5', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(pseudonymizeMessages).toHaveBeenCalledWith('user-del-5', expect.stringMatching(/^deleted_user_/));
  });

  it('pseudonymizes audit event actorIds', async () => {
    const { db } = await import('@twicely/db');
    const { pseudonymizeAuditEvents } = await import('@/lib/gdpr/pseudonymize');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-6' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-6', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(pseudonymizeAuditEvents).toHaveBeenCalledWith('user-del-6', expect.stringMatching(/^deleted_user_/));
  });

  it('hard-deletes addresses and tax info (4 delete calls total)', async () => {
    const { db } = await import('@twicely/db');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-7' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-7', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    // db.delete called for address, taxInfo, crosslisterAccount, dataExportRequest
    expect(db.delete).toHaveBeenCalledTimes(4);
  });

  it('replaces email with pseudonym@deleted.twicely.co', async () => {
    const { db } = await import('@twicely/db');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-9' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-9', email: 'real@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    const setCall = updateChain.set.mock.calls.find((args) => {
      const payload = args[0] as Record<string, unknown>;
      return typeof payload.email === 'string' && (payload.email as string).includes('@deleted.twicely.co');
    });
    expect(setCall).toBeDefined();
  });

  it('replaces username with pseudonym', async () => {
    const { db } = await import('@twicely/db');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-10' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-10', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    const setCall = updateChain.set.mock.calls.find((args) => {
      const payload = args[0] as Record<string, unknown>;
      return typeof payload.username === 'string' && (payload.username as string).startsWith('deleted_user_');
    });
    expect(setCall).toBeDefined();
  });

  it('creates CRITICAL audit event after deletion', async () => {
    const { db } = await import('@twicely/db');

    let n = 0;
    vi.mocked(db.select).mockImplementation(() => {
      n++;
      if (n === 1) return makeSelectChain([{ id: 'user-del-11' }]) as unknown as ReturnType<typeof db.select>;
      if (n === 2 || n === 3) return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
      return makeSelectChain([{ id: 'user-del-11', email: 'u@example.com' }]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await runAccountDeletionBatch();

    expect(db.insert).toHaveBeenCalled();
    const valuesCall = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(valuesCall?.severity).toBe('CRITICAL');
    expect(valuesCall?.action).toBe('ACCOUNT_DELETION_EXECUTED');
  });

  it('continues processing remaining users when one fails', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@/lib/logger');

    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const c = ++selectCallCount;
      if (c === 1) {
        return makeSelectChain([{ id: 'user-fail' }, { id: 'user-ok' }]) as unknown as ReturnType<typeof db.select>;
      }
      // user-fail's has-blockers check — throw to simulate failure
      if (c === 2) {
        // Make the chain throw when awaited at .where() level
        const err = new Error('DB error');
        const rejectingChain = {
          from: vi.fn().mockImplementation(function() { return rejectingChain; }),
          where: vi.fn().mockRejectedValue(err),
          limit: vi.fn().mockRejectedValue(err),
        };
        return rejectingChain as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });

    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as unknown as ReturnType<typeof db.delete>);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as unknown as ReturnType<typeof db.insert>);

    const { runAccountDeletionBatch } = await import('../account-deletion-executor');
    await expect(runAccountDeletionBatch()).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
