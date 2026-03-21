import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@twicely/db';
import { getQuestionsForListing, getQuestionById } from '../qa';

const mockSelect = vi.mocked(db.select);

// ─── Chain Helper ─────────────────────────────────────────────────────────────

function makeChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(data),
    limit: vi.fn().mockResolvedValue(data),
  };
}

// ─── Test Data ────────────────────────────────────────────────────────────────

const LISTING_ID = 'listing-test-001';
const QUESTION_ID = 'question-test-001';
const ASKER_ID = 'asker-test-001';

const baseQuestionRow = {
  id: QUESTION_ID,
  askerId: ASKER_ID,
  askerName: 'Alice Buyer',
  questionText: 'Does this come in blue?',
  answerText: null,
  answeredAt: null,
  answeredBy: null,
  isPinned: false,
  createdAt: new Date('2026-01-01'),
};

const pinnedQuestionRow = {
  ...baseQuestionRow,
  id: 'pinned-question-001',
  isPinned: true,
  questionText: 'What are the dimensions?',
};

const answeredQuestionRow = {
  ...baseQuestionRow,
  id: 'answered-question-001',
  answerText: 'Yes, available in blue.',
  answeredAt: new Date('2026-01-02'),
  answeredBy: 'seller-test-001',
};

const questionDetailRow = {
  id: QUESTION_ID,
  listingId: LISTING_ID,
  askerId: ASKER_ID,
  questionText: 'Does this come in blue?',
  answerText: null,
  answeredAt: null,
  answeredBy: null,
  isPinned: false,
  isHidden: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  listingOwnerUserId: 'seller-test-001',
  listingTitle: 'Cool Jacket',
  listingSlug: 'cool-jacket-abc123',
};

// ─── getQuestionsForListing ───────────────────────────────────────────────────

describe('getQuestionsForListing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns non-hidden questions in order', async () => {
    mockSelect.mockReturnValueOnce(makeChain([pinnedQuestionRow, baseQuestionRow]) as never);

    const result = await getQuestionsForListing(LISTING_ID);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('pinned-question-001');
    expect(result[1]?.id).toBe(QUESTION_ID);
  });

  it('returns empty array when listing has no questions', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getQuestionsForListing(LISTING_ID);

    expect(result).toEqual([]);
  });

  it('maps all required fields on QuestionSummary', async () => {
    mockSelect.mockReturnValueOnce(makeChain([answeredQuestionRow]) as never);

    const result = await getQuestionsForListing(LISTING_ID);

    expect(result[0]).toEqual({
      id: 'answered-question-001',
      askerId: ASKER_ID,
      askerName: 'Alice Buyer',
      questionText: 'Does this come in blue?',
      answerText: 'Yes, available in blue.',
      answeredAt: expect.any(Date),
      answeredBy: 'seller-test-001',
      isPinned: false,
      createdAt: expect.any(Date),
    });
  });

  it('does not include isHidden field in returned summary', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuestionRow]) as never);

    const result = await getQuestionsForListing(LISTING_ID);
    const question = result[0];

    // QuestionSummary intentionally omits isHidden (public-facing)
    expect(question).not.toHaveProperty('isHidden');
  });

  it('calls db.select (query is triggered)', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    await getQuestionsForListing(LISTING_ID);

    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── getQuestionById ──────────────────────────────────────────────────────────

describe('getQuestionById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns question with listing details', async () => {
    mockSelect.mockReturnValueOnce(makeChain([questionDetailRow]) as never);

    const result = await getQuestionById(QUESTION_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(QUESTION_ID);
    expect(result?.listingOwnerUserId).toBe('seller-test-001');
    expect(result?.listingTitle).toBe('Cool Jacket');
    expect(result?.listingSlug).toBe('cool-jacket-abc123');
  });

  it('returns null when question does not exist', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getQuestionById('nonexistent-id');

    expect(result).toBeNull();
  });

  it('maps all QuestionDetail fields correctly', async () => {
    mockSelect.mockReturnValueOnce(makeChain([questionDetailRow]) as never);

    const result = await getQuestionById(QUESTION_ID);

    expect(result).toEqual({
      id: QUESTION_ID,
      listingId: LISTING_ID,
      askerId: ASKER_ID,
      questionText: 'Does this come in blue?',
      answerText: null,
      answeredAt: null,
      answeredBy: null,
      isPinned: false,
      isHidden: false,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      listingOwnerUserId: 'seller-test-001',
      listingTitle: 'Cool Jacket',
      listingSlug: 'cool-jacket-abc123',
    });
  });

  it('includes isHidden in QuestionDetail (internal use)', async () => {
    const hiddenDetailRow = { ...questionDetailRow, isHidden: true };
    mockSelect.mockReturnValueOnce(makeChain([hiddenDetailRow]) as never);

    const result = await getQuestionById(QUESTION_ID);

    expect(result?.isHidden).toBe(true);
  });
});

// ─── Template coverage: qa.new_question and qa.answer_received ───────────────

describe('Q&A notification template keys exist in TEMPLATES', () => {
  it('qa.new_question template is defined with correct fields', async () => {
    const { TEMPLATES } = await import('@/lib/notifications/templates');
    const template = TEMPLATES['qa.new_question'];

    expect(template).toBeDefined();
    expect(template.key).toBe('qa.new_question');
    expect(template.category).toBe('qa');
    expect(template.priority).toBe('NORMAL');
    expect(template.defaultChannels).toContain('EMAIL');
    expect(template.defaultChannels).toContain('IN_APP');
    expect(template.subjectTemplate).toContain('{{itemTitle}}');
    expect(template.bodyTemplate).toContain('{{askerName}}');
    expect(template.bodyTemplate).toContain('{{questionText}}');
  });

  it('qa.answer_received template is defined with correct fields', async () => {
    const { TEMPLATES } = await import('@/lib/notifications/templates');
    const template = TEMPLATES['qa.answer_received'];

    expect(template).toBeDefined();
    expect(template.key).toBe('qa.answer_received');
    expect(template.category).toBe('qa');
    expect(template.priority).toBe('NORMAL');
    expect(template.defaultChannels).toContain('EMAIL');
    expect(template.defaultChannels).toContain('IN_APP');
    expect(template.subjectTemplate).toContain('{{itemTitle}}');
    expect(template.bodyTemplate).toContain('{{answerText}}');
  });
});
