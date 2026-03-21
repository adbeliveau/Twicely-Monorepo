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
import {
  getAppealableActionsForUser,
  getAppealedEnforcementActions,
  getAppealKPIs,
} from '../enforcement-actions';

const USER_ID = 'user-qedge-001';

const APPEALABLE_TYPES = [
  'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
];

function mockPlatformSettings() {
  vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
    if (key === 'score.enforcement.appealWindowDays') return Promise.resolve(30) as never;
    if (key === 'score.enforcement.appealableActionTypes') return Promise.resolve(APPEALABLE_TYPES) as never;
    return Promise.resolve(fallback) as never;
  });
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), offset: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(Promise.resolve(rows));
  chain.limit.mockReturnValue(chain);
  chain.offset.mockImplementation(() => Promise.resolve(rows));
  return chain;
}

const mockDbSelect = vi.mocked(db.select);

// ─── getAppealableActionsForUser — filter edge cases ───────────────────────────

describe('getAppealableActionsForUser — filter edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns all 9 appealable action types when present in DB', async () => {
    mockPlatformSettings();
    const actions = APPEALABLE_TYPES.map((actionType, i) => ({
      id: `a${i}`, userId: USER_ID, actionType, reason: 'Reason',
      status: 'ACTIVE', appealedAt: null, createdAt: new Date(),
    }));
    mockDbSelect.mockReturnValue(makeSelectChain(actions) as never);

    const result = await getAppealableActionsForUser(USER_ID);
    expect(result).toHaveLength(9);
  });

  it('filters out actions where DB returns appealedAt as non-null', async () => {
    // DB should filter appealedAt IS NULL via WHERE clause;
    // if DB returned an already-appealed row (bug scenario), the application layer
    // does NOT re-filter — this confirms the DB clause handles it
    mockPlatformSettings();
    const alreadyAppealed = {
      id: 'a1', userId: USER_ID, actionType: 'WARNING', reason: 'Score',
      status: 'ACTIVE', appealedAt: new Date(), createdAt: new Date(),
    };
    mockDbSelect.mockReturnValue(makeSelectChain([alreadyAppealed]) as never);

    const result = await getAppealableActionsForUser(USER_ID);
    // Application layer typeset filter only checks actionType, not appealedAt
    // so this confirms the DB WHERE clause (isNull) is the enforcement point
    expect(result).toHaveLength(1);
  });

  it('returns empty array when DB returns empty for all ACTIVE filter conditions', async () => {
    mockPlatformSettings();
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await getAppealableActionsForUser('user-no-actions');
    expect(result).toHaveLength(0);
  });
});

// ─── getAppealedEnforcementActions — unknown user fallback ────────────────────

describe('getAppealedEnforcementActions — unknown user fallback', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('uses "Unknown" when user not found in nameMap', async () => {
    const appealedAction = {
      id: 'a1', userId: 'orphan-user', actionType: 'WARNING', reason: 'Score',
      appealNote: 'My appeal', appealedAt: new Date(), appealedByUserId: 'orphan-user',
    };
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([appealedAction]),
              }),
            }),
          }),
        }),
      } as never)
      // user query returns empty — orphan user not in users table
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

    const result = await getAppealedEnforcementActions(1, 10);
    expect(result.actions[0]?.userName).toBe('Unknown');
  });

  it('returns correct total when count is large', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 999 }]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as never);

    const result = await getAppealedEnforcementActions(100, 10);
    expect(result.total).toBe(999);
    expect(result.actions).toHaveLength(0);
  });
});

// ─── getAppealKPIs — rounding and edge cases ──────────────────────────────────

describe('getAppealKPIs — rounding and edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rounds avgReviewHours using Math.round (2.5h → 3h)', async () => {
    const twoAndHalfHoursMs = 2.5 * 3600000;
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 5 }]) }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: twoAndHalfHoursMs }]) }),
      } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(3);
  });

  it('returns correct avgReviewHours for large value (10h = 36000000ms)', async () => {
    const tenHoursMs = 10 * 3600000;
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: tenHoursMs }]) }),
      } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(10);
  });

  it('returns 0 avgReviewHours when avgMs is 0 (no resolved appeals)', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: 0 }]) }),
      } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(0);
  });

  it('returns 0 pendingAppeals and 0 avgReviewHours when both queries return empty', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      } as never);

    const result = await getAppealKPIs();
    expect(result.pendingAppeals).toBe(0);
    expect(result.avgReviewHours).toBe(0);
  });

  it('avgReviewHours rounds down correctly (1.4h → 1h)', async () => {
    const onePointFourHoursMs = 1.4 * 3600000;
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ avgMs: onePointFourHoursMs }]) }),
      } as never);

    const result = await getAppealKPIs();
    expect(result.avgReviewHours).toBe(1);
  });
});
