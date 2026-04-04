import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/db/schema', () => ({
  contentReport: {
    id: 'id',
    reporterUserId: 'reporter_user_id',
    targetType: 'target_type',
    targetId: 'target_id',
    reason: 'reason',
    status: 'status',
    createdAt: 'created_at',
  },
  auditEvent: {},
  listing: { id: 'id', ownerUserId: 'owner_user_id' },
  review: { id: 'id', reviewerUserId: 'reviewer_user_id' },
  message: { id: 'id', senderUserId: 'sender_user_id' },
  user: { id: 'id' },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { submitContentReportAction } from '../content-report';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REPORTER_ID = 'reporter-ext-001';

function makeSession(userId: string) {
  return { userId, isSeller: false, delegationId: null, onBehalfOfSellerId: null };
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeRateLimitChain(count: number) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([{ count }]),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain = {
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'report-ext-001' }]) }),
  };
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);

// ─── MESSAGE target tests ──────────────────────────────────────────────────────

describe('submitContentReportAction — MESSAGE target', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('creates report for valid MESSAGE target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([{ senderUserId: 'other-sender' }]) as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitContentReportAction({
      targetType: 'MESSAGE',
      targetId: 'msg-001',
      reason: 'HARASSMENT',
    });

    expect(result.success).toBe(true);
  });

  it('rejects self-reporting own MESSAGE', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([{ senderUserId: REPORTER_ID }]) as never);

    const result = await submitContentReportAction({
      targetType: 'MESSAGE',
      targetId: 'msg-001',
      reason: 'HARASSMENT',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('own content');
  });

  it('rejects non-existent MESSAGE target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await submitContentReportAction({
      targetType: 'MESSAGE',
      targetId: 'msg-nonexistent',
      reason: 'SPAM',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });
});

// ─── USER target tests ────────────────────────────────────────────────────────

describe('submitContentReportAction — USER target', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('creates report for valid USER target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([{ id: 'other-user-001' }]) as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitContentReportAction({
      targetType: 'USER',
      targetId: 'other-user-001',
      reason: 'SPAM',
    });

    expect(result.success).toBe(true);
  });

  it('rejects self-reporting own USER profile', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    // USER lookup returns the row (user exists), but targetId === reporterUserId
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([{ id: REPORTER_ID }]) as never);

    const result = await submitContentReportAction({
      targetType: 'USER',
      targetId: REPORTER_ID,
      reason: 'SPAM',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('own content');
  });

  it('rejects non-existent USER target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await submitContentReportAction({
      targetType: 'USER',
      targetId: 'ghost-user',
      reason: 'SPAM',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });
});

// ─── Rate limit boundary test ─────────────────────────────────────────────────

describe('submitContentReportAction — rate limit boundary', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('allows exactly 9 reports (9 < 10 limit)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(9) as never)
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: 'other-seller' }]) as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitContentReportAction({
      targetType: 'LISTING',
      targetId: 'lst-rate-001',
      reason: 'COUNTERFEIT',
    });

    expect(result.success).toBe(true);
  });

  it('rejects exactly 10 reports (10 >= 10 limit)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect.mockReturnValueOnce(makeRateLimitChain(10) as never);

    const result = await submitContentReportAction({
      targetType: 'LISTING',
      targetId: 'lst-rate-002',
      reason: 'SPAM',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });
});

// ─── REVIEW self-report prevention ───────────────────────────────────────────

describe('submitContentReportAction — REVIEW self-report prevention', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects self-reporting own REVIEW', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([{ reviewerUserId: REPORTER_ID }]) as never);

    const result = await submitContentReportAction({
      targetType: 'REVIEW',
      targetId: 'rev-001',
      reason: 'MISLEADING',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('own content');
  });

  it('rejects non-existent REVIEW target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeRateLimitChain(0) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await submitContentReportAction({
      targetType: 'REVIEW',
      targetId: 'rev-nonexistent',
      reason: 'SHILL_REVIEWS',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });
});
