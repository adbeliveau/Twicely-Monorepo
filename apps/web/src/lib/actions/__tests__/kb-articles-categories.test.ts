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

function makeAgentSession() {
  return {
    session: { staffUserId: 'staff-agent-001', displayName: 'Agent', isPlatformStaff: true as const, platformRoles: ['HELPDESK_AGENT' as const] },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// Valid cuid2 IDs
const ARTICLE_ID = 'cljd4bvd00001wjh07mcy26y';

// ─── createKbCategory ────────────────────────────────────────────────────────

describe('createKbCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { createKbCategory } = await import('../kb-categories');
    const result = await createKbCategory({ slug: 'orders', name: 'Orders & Shipping' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('returns validation error for short slug', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { createKbCategory } = await import('../kb-categories');
    const result = await createKbCategory({ slug: 'a', name: 'Too Short Slug' });
    expect(result.success).toBe(false);
  });

  it('creates category and returns id', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const insertChain = makeChain([{ id: 'cat-test-001' }]);
    mockInsert.mockReturnValue(insertChain);

    const { createKbCategory } = await import('../kb-categories');
    const result = await createKbCategory({ slug: 'orders-shipping', name: 'Orders & Shipping' });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('cat-test-001');
  });
});

// ─── reorderKbCategories ──────────────────────────────────────────────────────

describe('reorderKbCategories', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { reorderKbCategories } = await import('../kb-categories');
    const result = await reorderKbCategories(['cat-1', 'cat-2']);
    expect(result.success).toBe(false);
  });

  it('updates sortOrder for each category id', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { reorderKbCategories } = await import('../kb-categories');
    const result = await reorderKbCategories(['cat-a', 'cat-b', 'cat-c']);
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

// ─── linkArticleToCase ────────────────────────────────────────────────────────

describe('linkArticleToCase', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    const { linkArticleToCase } = await import('../kb-feedback');
    await expect(linkArticleToCase('case-1', 'art-1', true)).rejects.toThrow('Forbidden');
  });

  it('inserts case-article link when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { linkArticleToCase } = await import('../kb-feedback');
    const result = await linkArticleToCase('case-test-001', 'article-test-001', true);
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});

// ─── submitArticleFeedback ────────────────────────────────────────────────────

describe('submitArticleFeedback', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns not authenticated for unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ session: null });
    const { submitArticleFeedback } = await import('../kb-feedback');
    const result = await submitArticleFeedback({ articleId: ARTICLE_ID, helpful: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('returns validation error for missing articleId', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-test-001' }, ability: { can: vi.fn().mockReturnValue(true) } });
    const { submitArticleFeedback } = await import('../kb-feedback');
    const result = await submitArticleFeedback({ helpful: true });
    expect(result.success).toBe(false);
  });

  it('submits feedback when authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-test-001' }, ability: { can: vi.fn().mockReturnValue(true) } });
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { submitArticleFeedback } = await import('../kb-feedback');
    const result = await submitArticleFeedback({ articleId: ARTICLE_ID, helpful: true });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('includes userId and helpful value when authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-test-001' }, ability: { can: vi.fn().mockReturnValue(true) } });
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { submitArticleFeedback } = await import('../kb-feedback');
    await submitArticleFeedback({ articleId: ARTICLE_ID, helpful: false, comment: 'Needs more detail' });
    const insertedValues = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues?.userId).toBe('user-test-001');
    expect(insertedValues?.helpful).toBe(false);
  });
});
