import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };
const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockLoggerError = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('@twicely/logger', () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
}));

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const QUESTION_ID = 'question-test-001';
const LISTING_ID = 'listing-test-001';
const OWNER_USER_ID = 'owner-test-001';
const ASKER_USER_ID = 'asker-test-001';
const ANSWERER_USER_ID = 'answerer-test-001';

const baseQuestion = {
  id: QUESTION_ID,
  listingId: LISTING_ID,
  askerId: ASKER_USER_ID,
  questionText: 'Does this come in blue?',
  isHidden: false,
};

const baseAnsweredQuestion = {
  id: QUESTION_ID,
  listingId: LISTING_ID,
  askerId: ASKER_USER_ID,
  answerText: 'Yes, we have it in blue.',
  answeredBy: ANSWERER_USER_ID,
  isHidden: false,
};

const baseListing = {
  ownerUserId: OWNER_USER_ID,
  title: 'Cool Jacket',
  slug: 'cool-jacket-abc123',
};

const askerUser = { name: 'Alice Buyer' };
const sellerUser = { name: 'Bob Seller' };
const askerUserRow = { name: 'Alice Buyer' };

// ─── notifyQuestionAsked tests ────────────────────────────────────────────────

describe('notifyQuestionAsked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sends notification to listing owner with correct payload', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseQuestion]))     // question
      .mockReturnValueOnce(makeSelectChain([baseListing]))      // listing
      .mockReturnValueOnce(makeSelectChain([askerUser]))        // asker
      .mockReturnValueOnce(makeSelectChain([sellerUser]));      // seller

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).toHaveBeenCalledWith(
      OWNER_USER_ID,
      'qa.new_question',
      expect.objectContaining({
        askerName: 'Alice Buyer',
        itemTitle: 'Cool Jacket',
        questionText: 'Does this come in blue?',
      })
    );
  });

  it('uses /i/ prefix in listing URL', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseQuestion]))
      .mockReturnValueOnce(makeSelectChain([baseListing]))
      .mockReturnValueOnce(makeSelectChain([askerUser]))
      .mockReturnValueOnce(makeSelectChain([sellerUser]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).toHaveBeenCalledWith(
      OWNER_USER_ID,
      'qa.new_question',
      expect.objectContaining({
        listingUrl: expect.stringContaining('/i/cool-jacket-abc123'),
      })
    );
  });

  it('truncates long question text to 200 chars', async () => {
    const longText = 'A'.repeat(300);
    const longQuestion = { ...baseQuestion, questionText: longText };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([longQuestion]))
      .mockReturnValueOnce(makeSelectChain([baseListing]))
      .mockReturnValueOnce(makeSelectChain([askerUser]))
      .mockReturnValueOnce(makeSelectChain([sellerUser]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    const callArgs = mockNotify.mock.calls[0]!;
    expect((callArgs[2] as Record<string, string>).questionText).toHaveLength(200);
  });

  it('skips notification when asker is listing owner (own question)', async () => {
    const ownQuestion = { ...baseQuestion, askerId: OWNER_USER_ID };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([ownQuestion]))
      .mockReturnValueOnce(makeSelectChain([baseListing]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when question is not found', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when question is hidden', async () => {
    const hiddenQuestion = { ...baseQuestion, isHidden: true };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([hiddenQuestion]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when listing is not found', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseQuestion]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not throw when notification fails', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseQuestion]))
      .mockReturnValueOnce(makeSelectChain([baseListing]))
      .mockReturnValueOnce(makeSelectChain([askerUser]))
      .mockReturnValueOnce(makeSelectChain([sellerUser]));
    mockNotify.mockRejectedValueOnce(new Error('Network error'));

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await expect(notifyQuestionAsked(QUESTION_ID)).resolves.toBeUndefined();
  });

  it('uses fallback names when user rows are missing', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseQuestion]))
      .mockReturnValueOnce(makeSelectChain([baseListing]))
      .mockReturnValueOnce(makeSelectChain([]))    // asker not found
      .mockReturnValueOnce(makeSelectChain([]));   // seller not found

    const { notifyQuestionAsked } = await import('../qa-notifier');
    await notifyQuestionAsked(QUESTION_ID);

    expect(mockNotify).toHaveBeenCalledWith(
      OWNER_USER_ID,
      'qa.new_question',
      expect.objectContaining({
        askerName: 'Someone',
        recipientName: 'there',
      })
    );
  });
});

// ─── notifyQuestionAnswered tests ─────────────────────────────────────────────

describe('notifyQuestionAnswered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sends notification to asker with correct payload', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseAnsweredQuestion]))   // question
      .mockReturnValueOnce(makeSelectChain([{ title: 'Cool Jacket', slug: 'cool-jacket-abc123' }])) // listing
      .mockReturnValueOnce(makeSelectChain([askerUserRow]));          // asker

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    expect(mockNotify).toHaveBeenCalledWith(
      ASKER_USER_ID,
      'qa.answer_received',
      expect.objectContaining({
        answerText: 'Yes, we have it in blue.',
        itemTitle: 'Cool Jacket',
        listingUrl: expect.stringContaining('/i/cool-jacket-abc123'),
      })
    );
  });

  it('truncates long answer text to 200 chars', async () => {
    const longAnswer = 'B'.repeat(300);
    const longAnsweredQ = { ...baseAnsweredQuestion, answerText: longAnswer };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([longAnsweredQ]))
      .mockReturnValueOnce(makeSelectChain([{ title: 'Item', slug: 'item-slug' }]))
      .mockReturnValueOnce(makeSelectChain([askerUserRow]));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    const callArgs = mockNotify.mock.calls[0]!;
    expect((callArgs[2] as Record<string, string>).answerText).toHaveLength(200);
  });

  it('skips when question has no answer text', async () => {
    const unanswered = { ...baseAnsweredQuestion, answerText: null };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([unanswered]));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when question is hidden', async () => {
    const hidden = { ...baseAnsweredQuestion, isHidden: true };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([hidden]));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when answerer is the asker (self-answer)', async () => {
    const selfAnswered = { ...baseAnsweredQuestion, answeredBy: ASKER_USER_ID };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([selfAnswered]));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips when question is not found', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await notifyQuestionAnswered(QUESTION_ID);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not throw when notification fails', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([baseAnsweredQuestion]))
      .mockReturnValueOnce(makeSelectChain([{ title: 'Item', slug: 'item' }]))
      .mockReturnValueOnce(makeSelectChain([askerUserRow]));
    mockNotify.mockRejectedValueOnce(new Error('Timeout'));

    const { notifyQuestionAnswered } = await import('../qa-notifier');
    await expect(notifyQuestionAnswered(QUESTION_ID)).resolves.toBeUndefined();
  });
});
