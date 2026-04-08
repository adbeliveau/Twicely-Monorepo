import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    update: vi.fn(),
    execute: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  order: { buyerId: 'buyer_id', sellerId: 'seller_id' },
  ledgerEntry: { userId: 'user_id' },
  payout: { userId: 'user_id' },
  message: { senderUserId: 'sender_user_id' },
  auditEvent: { actorId: 'actor_id' },
  affiliate: { userId: 'user_id' },
  affiliateCommission: {},
  affiliatePayout: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  sql: Object.assign(vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values })), {
    join: vi.fn(),
    raw: vi.fn(),
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue({ count: 3 }) };
  chain.set.mockReturnValue(chain);
  return chain;
}

describe('generatePseudonym', () => {
  it('generates correct format: deleted_user_ + 64 hex chars', async () => {
    const { generatePseudonym } = await import('../pseudonymize');
    const pseudonym = generatePseudonym('user-123');
    expect(pseudonym).toMatch(/^deleted_user_[0-9a-f]{64}$/);
  });

  it('generates different pseudonyms for same userId (ephemeral salt)', async () => {
    const { generatePseudonym } = await import('../pseudonymize');
    const p1 = generatePseudonym('user-abc');
    const p2 = generatePseudonym('user-abc');
    // Salt is random — different results each call
    expect(p1).not.toBe(p2);
  });

  it('starts with deleted_user_ prefix', async () => {
    const { generatePseudonym } = await import('../pseudonymize');
    const pseudonym = generatePseudonym('user-xyz');
    expect(pseudonym.startsWith('deleted_user_')).toBe(true);
  });

  it('is 77 characters total (13 prefix + 64 hash)', async () => {
    const { generatePseudonym } = await import('../pseudonymize');
    const pseudonym = generatePseudonym('user-test');
    expect(pseudonym.length).toBe(77);
  });
});

describe('pseudonymizeOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates buyer and seller IDs in orders', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);

    const { pseudonymizeOrders } = await import('../pseudonymize');
    const count = await pseudonymizeOrders('user-1', 'deleted_user_abc');
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(count).toBe(6); // 3 + 3 from both calls
  });
});

describe('pseudonymizeLedgerEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses raw SQL to bypass application-level immutability', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.execute).mockResolvedValue({ count: 5, rows: [] } as unknown as Awaited<ReturnType<typeof db.execute>>);

    const { pseudonymizeLedgerEntries } = await import('../pseudonymize');
    const count = await pseudonymizeLedgerEntries('user-1', 'deleted_user_abc');
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(count).toBe(5);
  });
});

describe('pseudonymizePayouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates userId on payout records', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);

    const { pseudonymizePayouts } = await import('../pseudonymize');
    await pseudonymizePayouts('user-1', 'deleted_user_abc');
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

describe('pseudonymizeMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates senderUserId on message records', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);

    const { pseudonymizeMessages } = await import('../pseudonymize');
    await pseudonymizeMessages('user-1', 'deleted_user_abc');
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('returns affected row count', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);

    const { pseudonymizeMessages } = await import('../pseudonymize');
    const count = await pseudonymizeMessages('user-2', 'deleted_user_xyz');
    expect(count).toBe(3);
  });
});

describe('pseudonymizeAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses raw SQL to bypass INSERT-only application constraint', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.execute).mockResolvedValue({
      count: 12,
      rows: [],
    } as unknown as Awaited<ReturnType<typeof db.execute>>);

    const { pseudonymizeAuditEvents } = await import('../pseudonymize');
    const count = await pseudonymizeAuditEvents('user-1', 'deleted_user_abc');
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(count).toBe(12);
  });
});

describe('pseudonymizeAffiliateRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates userId on affiliate table', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as unknown as ReturnType<typeof db.update>);

    const { pseudonymizeAffiliateRecords } = await import('../pseudonymize');
    await pseudonymizeAffiliateRecords('user-1', 'deleted_user_abc');
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when user had no affiliate records', async () => {
    const { db } = await import('@twicely/db');
    const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue({ count: 0 }) };
    chain.set.mockReturnValue(chain);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const { pseudonymizeAffiliateRecords } = await import('../pseudonymize');
    const count = await pseudonymizeAffiliateRecords('user-no-affiliate', 'deleted_user_abc');
    expect(count).toBe(0);
  });
});
