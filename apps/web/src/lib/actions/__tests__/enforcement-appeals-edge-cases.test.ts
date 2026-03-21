import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl/authorize', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  enforcementAction: {
    id: 'id', userId: 'user_id', actionType: 'action_type', status: 'status',
    appealedAt: 'appealed_at', appealNote: 'appeal_note', appealEvidenceUrls: 'appeal_evidence_urls',
    appealedByUserId: 'appealed_by_user_id', updatedAt: 'updated_at', createdAt: 'created_at',
  },
  sellerProfile: { userId: 'user_id' },
  listing: { id: 'id' },
  contentReport: { id: 'id' },
  auditEvent: {},
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { submitEnforcementAppealAction } from '../enforcement-appeals';

const USER_ID = 'user-edge-001';
const ACTION_ID = 'action-edge-001';
const APPEALABLE_TYPES = [
  'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
];

function makeAuthorizeSession(userId = USER_ID) {
  return {
    session: { userId, email: 'seller@test.com', isSeller: true },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() { return { values: vi.fn().mockResolvedValue(undefined) }; }

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

function mockPlatformSettings() {
  vi.mocked(getPlatformSetting).mockImplementation((key: string, fallback: unknown) => {
    if (key === 'score.enforcement.appealWindowDays') return Promise.resolve(30) as never;
    if (key === 'score.enforcement.maxAppealsPerAction') return Promise.resolve(1) as never;
    if (key === 'score.enforcement.appealableActionTypes') return Promise.resolve(APPEALABLE_TYPES) as never;
    return Promise.resolve(fallback) as never;
  });
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);

function makeActiveAction(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTION_ID, userId: USER_ID, actionType: 'WARNING',
    status: 'ACTIVE', appealedAt: null, createdAt: new Date(), ...overrides,
  };
}

// ─── Validation boundary tests ─────────────────────────────────────────────────

describe('submitEnforcementAppealAction — validation boundaries', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it.each([['1234567890', true], ['123456789', false]])(
    'appealNote len=%i valid=%s boundary', async (note, valid) => {
      mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
      if (valid) {
        mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
        mockPlatformSettings();
        mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
        mockDbInsert.mockReturnValue(makeInsertChain() as never);
      }
      const result = await submitEnforcementAppealAction({ enforcementActionId: ACTION_ID, appealNote: note });
      if (valid) expect(result.success).toBe(true);
      else expect(result.error).toBe('Invalid input');
    }
  );

  it('rejects appealNote at 2001 characters (over max)', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'A'.repeat(2001),
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects extra/unknown fields (strict schema)', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Valid appeal note here.',
      unknownField: 'injected',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects invalid URL in appealEvidenceUrls', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Valid appeal note here.',
      appealEvidenceUrls: ['not-a-valid-url'],
    });
    expect(result.error).toBe('Invalid input');
  });

  it('accepts exactly 5 evidence URLs (max allowed)', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Valid appeal with max evidence.',
      appealEvidenceUrls: [
        'https://example.com/1', 'https://example.com/2', 'https://example.com/3',
        'https://example.com/4', 'https://example.com/5',
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing enforcementActionId', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    const result = await submitEnforcementAppealAction({ appealNote: 'Valid appeal note here.' });
    expect(result.error).toBe('Invalid input');
  });
});

// ─── DB / ownership edge cases ─────────────────────────────────────────────────

describe('submitEnforcementAppealAction — DB and state edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns Not found when enforcement action does not exist in DB', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await submitEnforcementAppealAction({
      enforcementActionId: 'nonexistent-id',
      appealNote: 'Trying to appeal a nonexistent action.',
    });
    expect(result.error).toBe('Not found');
  });

  it('stores empty array for appealEvidenceUrls when not provided', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'This action was applied in error.',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.appealEvidenceUrls).toEqual([]);
  });

  it('createdAt = now is within window (not expired)', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ createdAt: new Date() })]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Appealing immediately upon receiving the action.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects appeal when action already has appealedAt set (already appealed)', async () => {
    // Implementation unconditionally checks appealedAt !== null (maxAppeals setting fetched but unused)
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ appealedAt: new Date() })]) as never);
    mockPlatformSettings();

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Trying to appeal an action that was already appealed.',
    });
    expect(result.error).toBe('This action has already been appealed');
  });

  it('returns Unauthenticated when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn().mockReturnValue(false) } } as never);

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Unauthenticated appeal attempt.',
    });
    expect(result.error).toBe('Unauthenticated');
  });
});

// ─── Audit event detail verification ──────────────────────────────────────────

describe('submitEnforcementAppealAction — audit event field verification', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('writes actorType USER and actorId = userId to audit event', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'This action was applied in error.',
    });

    const insertArgs = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs?.actorType).toBe('USER');
    expect(insertArgs?.actorId).toBe(USER_ID);
  });

  it('includes actionType and userId in audit event detailsJson', async () => {
    mockAuthorize.mockResolvedValue(makeAuthorizeSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ actionType: 'SUSPENSION' })]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'My suspension was issued in error.',
    });

    const details = (vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>)
      ?.detailsJson as Record<string, unknown>;
    expect(details?.actionType).toBe('SUSPENSION');
    expect(details?.userId).toBe(USER_ID);
  });
});
