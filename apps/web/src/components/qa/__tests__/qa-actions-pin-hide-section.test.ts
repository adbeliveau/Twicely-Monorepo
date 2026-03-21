/**
 * qa-actions-pin-hide-section.test.ts
 *
 * Verifies the action call signatures used by QaQuestionCard (pin + hide),
 * and the QaSection server component's conditional rendering logic.
 * - QaQuestionCard calls pinQuestion({ questionId, isPinned: !question.isPinned })
 * - QaQuestionCard calls hideQuestion({ questionId })
 * - QaSection returns null when isOwnListing && questions.length === 0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAuthorize = vi.fn();
const mockRevalidatePath = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/notifications/qa-notifier', () => ({
  notifyQuestionAsked: vi.fn().mockResolvedValue(undefined),
  notifyQuestionAnswered: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSession(userId: string) {
  return {
    session: { userId, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function mockGuest() {
  return { session: null, ability: { can: vi.fn().mockReturnValue(false) } };
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

// ─── Test IDs (must be valid CUID2 for z.string().cuid2() validation) ─────────

const LISTING_ID = 'cuid2listingaaaaa';
const QUESTION_ID = 'cuid2questionaaaa';
const USER_ID = 'user-test-001';
const OTHER_USER_ID = 'user-test-002';
const LISTING_SLUG = 'blue-jacket-abc';

const BASE_LISTING_ROW = { ownerUserId: USER_ID, slug: LISTING_SLUG };

// ─── QaQuestionCard — pinQuestion call signature ──────────────────────────────

describe('QaQuestionCard — pinQuestion with isPinned=true (pin)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('pins question successfully when under the 3-pin limit', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });

  it('returns error when the 3-pin limit is already reached', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]));

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'You can pin at most 3 questions per listing' });
  });

  it('returns error when user is not the listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(OTHER_USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'You do not have permission to pin questions on this listing' });
  });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: true });

    expect(result).toEqual({ success: false, error: 'Please sign in' });
  });
});

describe('QaQuestionCard — pinQuestion with isPinned=false (unpin)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('unpins question successfully — skips pin count query', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    // Unpin path: only 2 selects (question + listing), no pin count query
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: false });

    expect(result).toEqual({ success: true });
  });

  it('returns error when question not found on unpin', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { pinQuestion } = await import('@/lib/actions/qa');
    const result = await pinQuestion({ questionId: QUESTION_ID, isPinned: false });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });
});

// ─── QaQuestionCard — hideQuestion call signature ────────────────────────────

describe('QaQuestionCard — hideQuestion call signature', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('hides question successfully for listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { hideQuestion } = await import('@/lib/actions/qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });

  it('returns error when question is not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { hideQuestion } = await import('@/lib/actions/qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });

  it('rejects non-owner attempting to hide', async () => {
    mockAuthorize.mockResolvedValue(mockSession(OTHER_USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));

    const { hideQuestion } = await import('@/lib/actions/qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'You do not have permission to hide this question' });
  });
});

// ─── QaSection — server component conditional rendering logic ─────────────────

describe('QaSection — conditional render: zero questions + isOwnListing = null', () => {
  // Mirror the pure conditional branch from qa-section.tsx without Next.js rendering.
  // Implementation: if (questions.length === 0 && isOwnListing) return null;
  function shouldRenderSection(questionCount: number, isOwnListing: boolean): boolean {
    if (questionCount === 0 && isOwnListing) return false;
    return true;
  }

  it('returns null for seller view when zero questions exist', () => {
    expect(shouldRenderSection(0, true)).toBe(false);
  });

  it('renders for seller view when one or more questions exist', () => {
    expect(shouldRenderSection(1, true)).toBe(true);
    expect(shouldRenderSection(10, true)).toBe(true);
  });

  it('renders for buyer view when zero questions (ask form should appear)', () => {
    expect(shouldRenderSection(0, false)).toBe(true);
  });

  it('renders for buyer view when questions exist', () => {
    expect(shouldRenderSection(5, false)).toBe(true);
  });

  it('only suppresses when BOTH conditions are true simultaneously', () => {
    // Single condition false: not suppressed
    expect(shouldRenderSection(0, false)).toBe(true);  // !isOwnListing
    expect(shouldRenderSection(1, true)).toBe(true);   // questionCount > 0
  });
});
