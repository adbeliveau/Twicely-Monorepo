/**
 * qa-actions-ask-answer.test.ts
 *
 * Verifies the action call signatures used by AskQuestionForm and
 * AnswerQuestionForm, including MAX_LENGTH boundary enforcement.
 * - AskQuestionForm calls askQuestion({ listingId, questionText })
 * - AnswerQuestionForm calls answerQuestion({ questionId, answerText })
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

function makeInsertReturningChain(returnedId: string) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: returnedId }]),
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
const LISTING_SLUG = 'blue-jacket-abc';

const ACTIVE_LISTING = { id: LISTING_ID, status: 'ACTIVE', slug: LISTING_SLUG };
const BASE_QUESTION_ROW = {
  id: QUESTION_ID,
  listingId: LISTING_ID,
  askerId: 'asker-test-ccc',
  answeredAt: null,
  isHidden: false,
};
const BASE_LISTING_ROW = { ownerUserId: USER_ID, slug: LISTING_SLUG };

// ─── AskQuestionForm — action call signature ──────────────────────────────────

describe('AskQuestionForm — askQuestion call signature', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls askQuestion with listingId and questionText and succeeds', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('@/lib/actions/qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Does it fit large?' });

    expect(result).toEqual({ success: true, questionId: QUESTION_ID });
  });

  it('returns error result when listing is not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { askQuestion } = await import('@/lib/actions/qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Does it fit large?' });

    expect(result).toEqual({ success: false, error: 'Listing not found' });
  });

  it('returns error result with message when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { askQuestion } = await import('@/lib/actions/qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this real leather?' });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('revalidates the listing page path on success', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('@/lib/actions/qa');
    await askQuestion({ listingId: LISTING_ID, questionText: 'What color is it?' });

    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });
});

// ─── AskQuestionForm — MAX_LENGTH (500) constraint ───────────────────────────

describe('AskQuestionForm — ask form MAX_LENGTH boundary (500)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects question text over 500 chars with error containing "500"', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { askQuestion } = await import('@/lib/actions/qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Q'.repeat(501) });

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('accepts question text at exactly 500 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('@/lib/actions/qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Q'.repeat(500) });

    expect(result.success).toBe(true);
  });
});

// ─── AnswerQuestionForm — action call signature ───────────────────────────────

describe('AnswerQuestionForm — answerQuestion call signature', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls answerQuestion with questionId and answerText and succeeds', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([BASE_QUESTION_ROW]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { answerQuestion } = await import('@/lib/actions/qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes, available.' });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });

  it('returns error when question is already answered', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ ...BASE_QUESTION_ROW, answeredAt: new Date() }])
    );

    const { answerQuestion } = await import('@/lib/actions/qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'This question has already been answered' });
  });

  it('returns error when question is hidden (treat as not found)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(
      makeSelectChain([{ ...BASE_QUESTION_ROW, isHidden: true }])
    );

    const { answerQuestion } = await import('@/lib/actions/qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });
});

// ─── AnswerQuestionForm — MAX_LENGTH (1000) constraint ───────────────────────

describe('AnswerQuestionForm — answer form MAX_LENGTH boundary (1000)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects answer text over 1000 chars with error containing "1000"', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { answerQuestion } = await import('@/lib/actions/qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'A'.repeat(1001) });

    expect(result.success).toBe(false);
    expect(result.error).toContain('1000');
  });

  it('accepts answer text at exactly 1000 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([BASE_QUESTION_ROW]))
      .mockReturnValueOnce(makeSelectChain([BASE_LISTING_ROW]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { answerQuestion } = await import('@/lib/actions/qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'A'.repeat(1000) });

    expect(result.success).toBe(true);
  });
});
