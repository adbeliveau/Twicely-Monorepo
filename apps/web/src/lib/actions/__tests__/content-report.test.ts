import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
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

const REPORTER_ID = 'reporter-001';
const TARGET_LISTING_ID = 'lst-001';
const TARGET_OWNER_ID = 'seller-001';

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

function makeSelectChainWithWhere(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
  };
  // For rate limit count: returns result from where()
  chain.from.mockReturnValue(chain);
  chain.where.mockResolvedValue(rows);
  return chain;
}

function makeInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([{ id: 'report-001' }]),
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);

const validInput = {
  targetType: 'LISTING',
  targetId: TARGET_LISTING_ID,
  reason: 'COUNTERFEIT',
  description: 'This item appears to be a fake.',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitContentReportAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
  });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } as never });

    const result = await submitContentReportAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('rejects invalid input (Zod validation)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const result = await submitContentReportAction({ targetType: 'INVALID', targetId: 'x', reason: 'OTHER' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('creates report for valid listing target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    // Rate limit check (count = 0), then listing lookup
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainWithWhere([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: TARGET_OWNER_ID }]) as never);

    const result = await submitContentReportAction(validInput);

    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('creates report for valid review target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockDbSelect
      .mockReturnValueOnce(makeSelectChainWithWhere([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ reviewerUserId: 'other-user' }]) as never);

    const result = await submitContentReportAction({
      targetType: 'REVIEW',
      targetId: 'rev-001',
      reason: 'MISLEADING',
    });

    expect(result.success).toBe(true);
  });

  it('rejects self-reporting (reporter = target owner)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    // Rate limit check, then listing lookup showing reporter IS the owner
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainWithWhere([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: REPORTER_ID }]) as never);

    const result = await submitContentReportAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('own content');
  });

  it('enforces rate limit (11th report in 24h rejected)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    // Rate limit count = 10 (at limit)
    mockDbSelect.mockReturnValueOnce(makeSelectChainWithWhere([{ count: 10 }]) as never);

    const result = await submitContentReportAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  it('rejects non-existent target', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    // Rate limit check passes, then listing lookup returns empty
    mockDbSelect
      .mockReturnValueOnce(makeSelectChainWithWhere([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await submitContentReportAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });

  it('creates audit event on success', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(REPORTER_ID) as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockDbSelect
      .mockReturnValueOnce(makeSelectChainWithWhere([{ count: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: TARGET_OWNER_ID }]) as never);

    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await submitContentReportAction(validInput);

    // insert called twice: contentReport + auditEvent
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });
});
