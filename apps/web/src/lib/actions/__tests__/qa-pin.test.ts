import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

const mockAuthorize = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/notifications/qa-notifier', () => ({
  notifyQuestionAsked: vi.fn().mockResolvedValue(undefined),
  notifyQuestionAnswered: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(userId: string) {
  return {
    session: { userId, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function mockGuest() {
  return { session: null, ability: { can: vi.fn().mockReturnValue(false) } };
}

function mockNoCasl() {
  return {
    session: { userId: 'user-test-001', onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Test IDs ────────────────────────────────────────────────────────────────

const USER_ID = 'user-test-001';
const OTHER_USER_ID = 'other-user-002';
const LISTING_ID = 'listing-test-001';
const QUESTION_ID = 'cuid2questionaaaa';
const LISTING_SLUG = 'cool-jacket-abc123';

const baseListingRow = { ownerUserId: USER_ID, slug: LISTING_SLUG };

// ─── pinQuestion ──────────────────────────────────────────────────────────────

describe('pinQuestion — authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'Please sign in' });
  });

  it('rejects when CASL denies update ListingQuestion', async () => {
    mockAuthorize.mockResolvedValue(mockNoCasl());

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'You do not have permission to pin questions' });
  });
});

describe('pinQuestion — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { pinQuestion } = await import('../qa');
    const inputWithExtra = Object.assign(
      { questionId: QUESTION_ID, isPinned: true },
      { extra: 'bad' }
    );
    const result = await pinQuestion(inputWithExtra);

    expect(result.success).toBe(false);
  });
});

describe('pinQuestion — business rules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns error when question not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });

  it('rejects when user is not the listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(OTHER_USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: USER_ID, slug: LISTING_SLUG }]));

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'You do not have permission to pin questions on this listing' });
  });

  it('rejects when already 3 pinned questions', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([baseListingRow]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]));

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'You can pin at most 3 questions per listing' });
  });

  it('allows unpin even when 3 are already pinned (no count query)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    // Unpinning skips the pin count check — only 2 select calls
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([baseListingRow]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: false });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });

  it('pins question successfully when fewer than 3 pinned', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([baseListingRow]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });

  it('allows pin when exactly 0 questions are pinned', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([baseListingRow]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { pinQuestion } = await import('../qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: true });
  });
});
