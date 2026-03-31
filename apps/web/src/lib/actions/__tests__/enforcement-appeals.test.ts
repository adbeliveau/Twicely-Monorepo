import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));

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
  auditEvent: {},
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { submitEnforcementAppealAction } from '../enforcement-appeals';

const USER_ID = 'user-001';
const ACTION_ID = 'action-001';
const APPEALABLE_TYPES = ['WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION'];

function makeCaslSession() {
  return { userId: USER_ID, email: 'seller@test.com', isSeller: true };
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
  return { id: ACTION_ID, userId: USER_ID, actionType: 'WARNING',
    status: 'ACTIVE', appealedAt: null, createdAt: new Date(), ...overrides };
}

// ─── submitEnforcementAppealAction ────────────────────────────────────────────

describe('submitEnforcementAppealAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it.each([
    ['WARNING'], ['RESTRICTION'], ['SUSPENSION'], ['PRE_SUSPENSION'], ['LISTING_REMOVAL'],
  ])('submits appeal for ACTIVE %s action within window', async (actionType) => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ actionType })]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'This action was applied in error.',
    });
    expect(result.success).toBe(true);
  });

  it.each([['COACHING'], ['ACCOUNT_BAN'], ['REVIEW_REMOVAL']])(
    'rejects appeal for %s action (not appealable)', async (actionType) => {
      mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
      mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ actionType })]) as never);
      mockPlatformSettings();

      const result = await submitEnforcementAppealAction({
        enforcementActionId: ACTION_ID, appealNote: 'I want to appeal this action.',
      });
      expect(result.error).toBe('This action type cannot be appealed');
    });

  it('rejects appeal outside appeal window (expired)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ createdAt: oldDate })]) as never);
    mockPlatformSettings();

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'Trying to appeal an expired window action.',
    });
    expect(result.error).toBe('Appeal window has expired');
  });

  it('rejects appeal for already-appealed action (one per action)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ appealedAt: new Date() })]) as never);
    mockPlatformSettings();

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'Trying to appeal again.',
    });
    expect(result.error).toBe('This action has already been appealed');
  });

  it.each([['EXPIRED'], ['LIFTED']])('rejects appeal for %s enforcement action', async (status) => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ status })]) as never);
    mockPlatformSettings();

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: `Trying to appeal a ${status} action.`,
    });
    expect(result.error).toBe('Only active enforcement actions can be appealed');
  });

  it('rejects appeal for action owned by different user (ownership check)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction({ userId: 'other-user' })]) as never);
    mockPlatformSettings();

    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'Trying to appeal someone else action.',
    });
    expect(result.error).toBe('Not found');
  });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn().mockReturnValue(false) } } as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'Unauthenticated appeal attempt.',
    });
    expect(result.error).toBe('Unauthenticated');
  });

  it('rejects invalid input (missing note)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    const result = await submitEnforcementAppealAction({ enforcementActionId: ACTION_ID });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects note that is too short (under 10 chars)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'Short',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects too many evidence URLs (over 5)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    const result = await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'Valid appeal note with sufficient length.',
      appealEvidenceUrls: [
        'https://example.com/1', 'https://example.com/2', 'https://example.com/3',
        'https://example.com/4', 'https://example.com/5', 'https://example.com/6',
      ],
    });
    expect(result.error).toBe('Invalid input');
  });

  it('sets enforcement action status to APPEALED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'This action was applied in error.',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('APPEALED');
  });

  it('sets appealedAt, appealNote, appealedByUserId, appealEvidenceUrls', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      appealNote: 'This action was applied in error.',
      appealEvidenceUrls: ['https://example.com/evidence'],
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.appealNote).toBe('This action was applied in error.');
    expect(setArgs?.appealedByUserId).toBe(USER_ID);
    expect(setArgs?.appealedAt).toBeInstanceOf(Date);
    expect(setArgs?.appealEvidenceUrls).toEqual(['https://example.com/evidence']);
  });

  it('creates audit event with correct fields', async () => {
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'This action was applied in error.',
    });

    const insertArgs = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs?.action).toBe('ENFORCEMENT_APPEAL_SUBMITTED');
    expect(insertArgs?.subject).toBe('EnforcementAction');
    expect(insertArgs?.subjectId).toBe(ACTION_ID);
    expect(insertArgs?.severity).toBe('HIGH');
  });

  it('revalidates performance and enforcement paths', async () => {
    const { revalidatePath } = await import('next/cache');
    mockAuthorize.mockResolvedValue({ session: makeCaslSession(), ability: { can: vi.fn().mockReturnValue(true) } } as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeActiveAction()]) as never);
    mockPlatformSettings();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await submitEnforcementAppealAction({
      enforcementActionId: ACTION_ID, appealNote: 'This action was applied in error.',
    });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/my/selling/performance');
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/mod/enforcement');
  });
});
