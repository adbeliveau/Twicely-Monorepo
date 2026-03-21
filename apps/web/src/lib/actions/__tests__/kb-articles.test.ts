import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete };
const mockStaffAuthorize = vi.fn();
const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnVal),
    returning: vi.fn().mockResolvedValue(returnVal),
  };
  Object.defineProperty(chain, 'then', {
    get() { return (res: (v: unknown) => void) => Promise.resolve(returnVal).then(res); },
  });
  return chain;
}

function makeLeadSession() {
  return {
    session: { staffUserId: 'staff-lead-001', displayName: 'Lead', isPlatformStaff: true as const, platformRoles: ['HELPDESK_LEAD' as const] },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeManagerSession() {
  return {
    session: { staffUserId: 'staff-manager-001', displayName: 'Manager', isPlatformStaff: true as const, platformRoles: ['HELPDESK_MANAGER' as const] },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeAgentSession() {
  return {
    session: { staffUserId: 'staff-agent-001', displayName: 'Agent', isPlatformStaff: true as const, platformRoles: ['HELPDESK_AGENT' as const] },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// Valid cuid2 IDs
const CATEGORY_ID = 'cljd4bvd00002wjh07mcy26z';

const VALID_ARTICLE_INPUT = {
  categoryId: CATEGORY_ID,
  slug: 'how-returns-work',
  title: 'How Returns Work on Twicely',
  body: 'This article explains how to initiate a return for any item purchased on Twicely.',
};

// ─── createKbArticle ──────────────────────────────────────────────────────────

describe('createKbArticle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    const { createKbArticle } = await import('../kb-articles');
    await expect(createKbArticle(VALID_ARTICLE_INPUT)).rejects.toThrow('Forbidden');
  });

  it('returns access denied for agent (not lead)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { createKbArticle } = await import('../kb-articles');
    const result = await createKbArticle(VALID_ARTICLE_INPUT);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('returns validation error for slug with uppercase', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { createKbArticle } = await import('../kb-articles');
    const result = await createKbArticle({ ...VALID_ARTICLE_INPUT, slug: 'How-Returns-Work' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for short slug', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { createKbArticle } = await import('../kb-articles');
    const result = await createKbArticle({ ...VALID_ARTICLE_INPUT, slug: 'ab' });
    expect(result.success).toBe(false);
  });

  it('creates article as DRAFT and returns id and slug', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const insertChain = makeChain([{ id: 'article-test-001', slug: 'how-returns-work' }]);
    mockInsert.mockReturnValue(insertChain);

    const { createKbArticle } = await import('../kb-articles');
    const result = await createKbArticle(VALID_ARTICLE_INPUT);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('article-test-001');
    expect(result.data?.slug).toBe('how-returns-work');
    // Article should be created as DRAFT
    const insertedValues = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues?.status).toBe('DRAFT');
  });

  it('accepts all audience values', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const audiences = ['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY'] as const;
    for (const audience of audiences) {
      vi.clearAllMocks();
      mockStaffAuthorize.mockResolvedValue(makeLeadSession());
      const insertChain = makeChain([{ id: 'art-1', slug: 'test-slug-article' }]);
      mockInsert.mockReturnValue(insertChain);
      const { createKbArticle } = await import('../kb-articles');
      const result = await createKbArticle({ ...VALID_ARTICLE_INPUT, audience });
      expect(result.success).toBe(true);
    }
  });
});

// ─── publishKbArticle ─────────────────────────────────────────────────────────

describe('publishKbArticle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle('article-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns not found for nonexistent article', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle('article-no-exist');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('sets status PUBLISHED and increments version', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'article-1', version: 1 }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle('article-1');
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUBLISHED', version: 2, publishedAt: expect.any(Date) })
    );
  });
});

// ─── archiveKbArticle ─────────────────────────────────────────────────────────

describe('archiveKbArticle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { archiveKbArticle } = await import('../kb-articles');
    const result = await archiveKbArticle('article-1');
    expect(result.success).toBe(false);
  });

  it('sets status ARCHIVED when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { archiveKbArticle } = await import('../kb-articles');
    const result = await archiveKbArticle('article-test-001');
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'ARCHIVED' }));
  });
});

// ─── submitForReview ──────────────────────────────────────────────────────────

describe('submitForReview', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { submitForReview } = await import('../kb-articles');
    const result = await submitForReview('article-1');
    expect(result.success).toBe(false);
  });

  it('sets status REVIEW when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { submitForReview } = await import('../kb-articles');
    const result = await submitForReview('article-test-001');
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'REVIEW' }));
  });
});
