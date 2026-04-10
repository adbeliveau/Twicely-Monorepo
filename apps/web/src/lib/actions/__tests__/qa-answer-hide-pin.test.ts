import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

const mockAuthorize = vi.fn();
const mockNotifyAnswered = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();
const mockGetQuestionById = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/notifications/qa-notifier', () => ({
  notifyQuestionAsked: vi.fn().mockResolvedValue(undefined),
  notifyQuestionAnswered: (...args: unknown[]) => mockNotifyAnswered(...args),
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@/lib/queries/qa', () => ({
  getQuestionById: (...args: unknown[]) => mockGetQuestionById(...args),
  getQuestionsForListing: vi.fn().mockResolvedValue([]),
}));

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

const baseQuestionRow = {
  id: QUESTION_ID,
  listingId: LISTING_ID,
  askerId: 'asker-test-001',
  answeredAt: null,
  isHidden: false,
};

const baseListingRow = { ownerUserId: USER_ID, slug: LISTING_SLUG };

// ─── answerQuestion — authentication ─────────────────────────────────────────

describe('answerQuestion — authentication', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes it does.' });

    expect(result).toEqual({ success: false, error: 'Please sign in to answer questions' });
  });

  it('rejects when CASL denies update ListingQuestion', async () => {
    mockAuthorize.mockResolvedValue(mockNoCasl());

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes it does.' });

    expect(result).toEqual({ success: false, error: 'You do not have permission to answer questions' });
  });
});

// ─── answerQuestion — validation ──────────────────────────────────────────────

describe('answerQuestion — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects answer over 1000 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'A'.repeat(1001) });

    expect(result).toEqual({ success: false, error: 'Answer must be under 1000 characters' });
  });

  it('rejects empty answer text', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: '' });

    expect(result).toEqual({ success: false, error: 'Answer is required' });
  });

  it('rejects unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { answerQuestion } = await import('../qa');
    const inputWithExtra = Object.assign(
      { questionId: QUESTION_ID, answerText: 'Yes.' },
      { bad: 'field' }
    );
    const result = await answerQuestion(inputWithExtra);

    expect(result.success).toBe(false);
  });
});

// ─── answerQuestion — business rules ─────────────────────────────────────────

describe('answerQuestion — business rules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns error when question not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockGetQuestionById.mockResolvedValue(null);

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });

  it('returns error when question is hidden', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockGetQuestionById.mockResolvedValue({
      ...baseQuestionRow,
      isHidden: true,
      listingOwnerUserId: USER_ID,
      listingSlug: LISTING_SLUG,
      listingTitle: 'Test Listing',
      questionText: 'Test question?',
      answerText: null,
      answeredBy: null,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });

  it('returns error when question already answered', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockGetQuestionById.mockResolvedValue({
      ...baseQuestionRow,
      answeredAt: new Date(),
      isHidden: false,
      listingOwnerUserId: USER_ID,
      listingSlug: LISTING_SLUG,
      listingTitle: 'Test Listing',
      questionText: 'Test question?',
      answerText: 'Already answered.',
      answeredBy: USER_ID,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'This question has already been answered' });
  });

  it('rejects when user is not the listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(OTHER_USER_ID));
    mockGetQuestionById.mockResolvedValue({
      ...baseQuestionRow,
      answeredAt: null,
      isHidden: false,
      listingOwnerUserId: USER_ID,
      listingSlug: LISTING_SLUG,
      listingTitle: 'Test Listing',
      questionText: 'Test question?',
      answerText: null,
      answeredBy: null,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes.' });

    expect(result).toEqual({ success: false, error: 'You do not have permission to answer this question' });
  });

  it('updates question and calls notifyQuestionAnswered on success', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockGetQuestionById.mockResolvedValue({
      ...baseQuestionRow,
      answeredAt: null,
      isHidden: false,
      listingOwnerUserId: USER_ID,
      listingSlug: LISTING_SLUG,
      listingTitle: 'Test Listing',
      questionText: 'Test question?',
      answerText: null,
      answeredBy: null,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { answerQuestion } = await import('../qa');
    const result = await answerQuestion({ questionId: QUESTION_ID, answerText: 'Yes, available in blue.' });

    expect(result).toEqual({ success: true });
    expect(mockNotifyAnswered).toHaveBeenCalledWith(QUESTION_ID);
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });
});

// ─── hideQuestion ─────────────────────────────────────────────────────────────

describe('hideQuestion', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('rejects unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { hideQuestion } = await import('../qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'Please sign in' });
  });

  it('rejects when CASL denies delete ListingQuestion', async () => {
    mockAuthorize.mockResolvedValue(mockNoCasl());

    const { hideQuestion } = await import('../qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'You do not have permission to hide questions' });
  });

  it('returns error when question not found', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { hideQuestion } = await import('../qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'Question not found' });
  });

  it('rejects when user is not listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(OTHER_USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([{ ownerUserId: USER_ID, slug: LISTING_SLUG }]));

    const { hideQuestion } = await import('../qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: false, error: 'You do not have permission to hide this question' });
  });

  it('sets isHidden true for listing owner', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]))
      .mockReturnValueOnce(makeSelectChain([baseListingRow]));
    mockDbUpdate.mockReturnValueOnce(makeUpdateChain());

    const { hideQuestion } = await import('../qa');
    const result = await hideQuestion({ questionId: QUESTION_ID });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/i/${LISTING_SLUG}`);
  });
});
