import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  enforcementAction: {
    id: 'id',
    userId: 'user_id',
    actionType: 'action_type',
    reason: 'reason',
    status: 'status',
    appealedAt: 'appealed_at',
    appealedByUserId: 'appealed_by_user_id',
    appealNote: 'appeal_note',
    appealResolvedAt: 'appeal_resolved_at',
    createdAt: 'created_at',
  },
  user: { id: 'id', name: 'name' },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAppealableActionsForUser, getAppealedEnforcementActions, getAppealKPIs } from '../enforcement-actions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';

const APPEALABLE_TYPES = ['WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION', 'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION'];

function mockPlatformSettings() {
  vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
    if (key === 'score.enforcement.appealWindowDays') return Promise.resolve(30) as never;
    if (key === 'score.enforcement.appealableActionTypes') return Promise.resolve(APPEALABLE_TYPES) as never;
    return Promise.resolve(fallback) as never;
  });
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
    offset: vi.fn(),
    select: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(Promise.resolve(rows));
  chain.limit.mockReturnValue(chain);
  // offset is the final resolver for paginated queries
  chain.offset.mockImplementation(() => Promise.resolve(rows));
  return chain;
}

const mockDbSelect = vi.mocked(db.select);

// ─── getAppealableActionsForUser ───────────────────────────────────────────────

describe('getAppealableActionsForUser', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns only ACTIVE actions within appeal window with no appealedAt', async () => {
    mockPlatformSettings();
    const recentAction = { id: 'a1', userId: USER_ID, actionType: 'WARNING', reason: 'Low score', status: 'ACTIVE', appealedAt: null, createdAt: new Date() };
    const chain = makeSelectChain([recentAction]);
    mockDbSelect.mockReturnValue(chain as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe('a1');
  });

  it('excludes non-appealable action types (COACHING)', async () => {
    mockPlatformSettings();
    const coachingAction = { id: 'a1', userId: USER_ID, actionType: 'COACHING', reason: 'Tips', status: 'ACTIVE', appealedAt: null, createdAt: new Date() };
    const chain = makeSelectChain([coachingAction]);
    mockDbSelect.mockReturnValue(chain as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result.length).toBe(0);
  });

  it('excludes non-appealable action types (ACCOUNT_BAN)', async () => {
    mockPlatformSettings();
    const banAction = { id: 'a1', userId: USER_ID, actionType: 'ACCOUNT_BAN', reason: 'Ban', status: 'ACTIVE', appealedAt: null, createdAt: new Date() };
    const chain = makeSelectChain([banAction]);
    mockDbSelect.mockReturnValue(chain as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result.length).toBe(0);
  });

  it('returns empty array for user with no enforcement actions', async () => {
    mockPlatformSettings();
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result).toHaveLength(0);
  });

  it('returns multiple appealable actions for user', async () => {
    mockPlatformSettings();
    const actions = [
      { id: 'a1', userId: USER_ID, actionType: 'WARNING', reason: 'Score', status: 'ACTIVE', appealedAt: null, createdAt: new Date() },
      { id: 'a2', userId: USER_ID, actionType: 'RESTRICTION', reason: 'Policy', status: 'ACTIVE', appealedAt: null, createdAt: new Date() },
    ];
    const chain = makeSelectChain(actions);
    mockDbSelect.mockReturnValue(chain as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result.length).toBe(2);
  });
});

// ─── getAppealedEnforcementActions ────────────────────────────────────────────

describe('getAppealedEnforcementActions', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns only APPEALED status actions', async () => {
    const appealedAction = {
      id: 'a1', userId: USER_ID, actionType: 'WARNING', reason: 'Score',
      appealNote: 'My appeal', appealedAt: new Date(), appealedByUserId: USER_ID,
    };
    // First call: count; second call: rows; third call: user names
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([appealedAction]) }) }) }) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: USER_ID, name: 'Test Seller' }]) }) } as never);

    const result = await getAppealedEnforcementActions(1, 10);
    expect(result.total).toBe(1);
    expect(result.actions[0]?.id).toBe('a1');
  });

  it('includes user name via join', async () => {
    const appealedAction = {
      id: 'a1', userId: USER_ID, actionType: 'WARNING', reason: 'Score',
      appealNote: 'My appeal', appealedAt: new Date(), appealedByUserId: USER_ID,
    };
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([appealedAction]) }) }) }) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: USER_ID, name: 'Jane Seller' }]) }) } as never);

    const result = await getAppealedEnforcementActions(1, 10);
    expect(result.actions[0]?.userName).toBe('Jane Seller');
  });

  it('returns empty result when no appeals pending', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }) }) }) }) } as never);

    const result = await getAppealedEnforcementActions(1, 10);
    expect(result.total).toBe(0);
    expect(result.actions).toHaveLength(0);
  });

  it('paginates correctly (page 2)', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 25 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }) }) }) }) } as never);

    const result = await getAppealedEnforcementActions(2, 10);
    expect(result.total).toBe(25);
  });
});

// ─── getAppealKPIs ─────────────────────────────────────────────────────────────

describe('getAppealKPIs', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns correct pendingAppeals count', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 7 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: 0 }]) }) } as never);

    const result = await getAppealKPIs();
    expect(result.pendingAppeals).toBe(7);
  });

  it('calculates avgReviewHours from resolved appeals', async () => {
    const twoHoursMs = 2 * 3600000;
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: twoHoursMs }]) }) } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(2);
  });

  it('returns 0 avgReviewHours when no resolved appeals', async () => {
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: null }]) }) } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(0);
  });
});
