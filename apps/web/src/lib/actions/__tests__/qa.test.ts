import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

const mockAuthorize = vi.fn();
const mockNotifyAsked = vi.fn().mockResolvedValue(undefined);
const mockNotifyAnswered = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));
vi.mock('@twicely/notifications/qa-notifier', () => ({
  notifyQuestionAsked: (...args: unknown[]) => mockNotifyAsked(...args),
  notifyQuestionAnswered: (...args: unknown[]) => mockNotifyAnswered(...args),
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(userId: string, overrides?: Record<string, unknown>) {
  return {
    session: { userId, onBehalfOfSellerId: null, ...overrides },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function mockGuest() {
  return { session: null, ability: { can: vi.fn().mockReturnValue(false) } };
}

function makeSelectChain(rows: unknown[]) {
  // where() returns a thenable so it works as both terminal (awaited directly)
  // and non-terminal (followed by .limit())
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

// ─── Test IDs ────────────────────────────────────────────────────────────────

const USER_ID = 'user-test-001';
const LISTING_ID = 'cuid2listingaaaaa';
const QUESTION_ID = 'cuid2questionaaaa';
const ACTIVE_LISTING = { id: LISTING_ID, status: 'ACTIVE', slug: 'cool-jacket' };
const DRAFT_LISTING = { id: LISTING_ID, status: 'DRAFT', slug: 'cool-jacket' };

// ─── askQuestion — auth & validation ────────────────────────────────────────

describe('askQuestion — authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects unauthenticated request', async () => {
    mockAuthorize.mockResolvedValue(mockGuest());

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result).toEqual({ success: false, error: 'Please sign in to ask a question' });
  });

  it('rejects when CASL denies create ListingQuestion', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: USER_ID },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result).toEqual({ success: false, error: 'You do not have permission to ask questions' });
  });
});

describe('askQuestion — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects missing listingId', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: '', questionText: 'Valid question here?' });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects question under 5 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Hi?' });

    expect(result).toEqual({ success: false, error: 'Question must be at least 5 characters' });
  });

  it('rejects question over 500 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'A'.repeat(501) });

    expect(result).toEqual({ success: false, error: 'Question must be under 500 characters' });
  });

  it('accepts question at exactly 5 chars', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Why??' });

    expect(result.success).toBe(true);
  });

  it('rejects unknown keys (strict mode)', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));

    const { askQuestion } = await import('../qa');
    const inputWithExtra = Object.assign(
      { listingId: LISTING_ID, questionText: 'Valid question here?' },
      { extraField: 'bad' }
    );
    const result = await askQuestion(inputWithExtra);

    expect(result.success).toBe(false);
  });
});

describe('askQuestion — business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects when listing does not exist', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result).toEqual({ success: false, error: 'Listing not found' });
  });

  it('rejects when listing is not ACTIVE', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([DRAFT_LISTING]));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result).toEqual({ success: false, error: 'This listing is not available' });
  });

  it('rejects when user already has 3 unanswered questions', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result).toEqual({ success: false, error: 'You already have 3 unanswered questions on this listing' });
  });

  it('allows when user has exactly 2 unanswered questions', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Is this available?' });

    expect(result.success).toBe(true);
    expect(result.questionId).toBe(QUESTION_ID);
  });

  it('creates question and returns questionId on success', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('../qa');
    const result = await askQuestion({ listingId: LISTING_ID, questionText: 'Does this come in blue?' });

    expect(result).toEqual({ success: true, questionId: QUESTION_ID });
  });

  it('calls notifyQuestionAsked after insert', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('../qa');
    await askQuestion({ listingId: LISTING_ID, questionText: 'Does this come in blue?' });

    expect(mockNotifyAsked).toHaveBeenCalledWith(QUESTION_ID);
  });

  it('revalidates listing path after insert', async () => {
    mockAuthorize.mockResolvedValue(mockSession(USER_ID));
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ACTIVE_LISTING]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    mockDbInsert.mockReturnValueOnce(makeInsertReturningChain(QUESTION_ID));

    const { askQuestion } = await import('../qa');
    await askQuestion({ listingId: LISTING_ID, questionText: 'Does this come in blue?' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/i/cool-jacket');
  });
});
