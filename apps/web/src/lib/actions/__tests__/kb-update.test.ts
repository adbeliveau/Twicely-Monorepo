import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function makeLeadSession() {
  return {
    session: {
      staffUserId: 'staff-lead-001',
      displayName: 'Lead',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_LEAD' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeAgentSession() {
  return {
    session: {
      staffUserId: 'staff-agent-001',
      displayName: 'Agent',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
    },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// Valid cuid2 IDs
const ARTICLE_ID = 'cljd4bvd00001wjh07mcy26y';
const CATEGORY_ID = 'cljd4bvd00002wjh07mcy26z';

describe('updateKbArticle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, title: 'New Title' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('returns validation error for bad slug format', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, slug: 'Bad Slug With Spaces' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns not found for nonexistent article', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, title: 'Title' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('updates title when article exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, title: 'Updated Title' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title' })
    );
  });

  it('updates body when article exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({
      articleId: ARTICLE_ID,
      body: 'Updated body content for the article with enough text.',
    });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Updated body content for the article with enough text.' })
    );
  });

  it('updates audience when provided', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, audience: 'SELLER' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'SELLER' })
    );
  });

  it('updates tags when provided', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID, tags: ['returns', 'shipping'] });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['returns', 'shipping'] })
    );
  });

  it('updates multiple fields at once', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({
      articleId: ARTICLE_ID,
      title: 'Multi-field Update',
      audience: 'BUYER',
      isFeatured: true,
      categoryId: CATEGORY_ID,
    });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Multi-field Update',
        audience: 'BUYER',
        isFeatured: true,
        categoryId: CATEGORY_ID,
      })
    );
  });

  it('always sets updatedAt in the update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    await updateKbArticle({ articleId: ARTICLE_ID, title: 'Title Check' });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) })
    );
  });

  it('accepts partial update with only articleId (no other fields)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ articleId: ARTICLE_ID });
    expect(result.success).toBe(true);
  });

  it('rejects missing articleId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { updateKbArticle } = await import('../kb-articles');
    const result = await updateKbArticle({ title: 'No ID' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── publishKbArticle — role check ───────────────────────────────────────────

describe('publishKbArticle — MANAGER role check', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for HELPDESK_LEAD (cannot publish)', async () => {
    // LEAD has can('manage') = true but not MANAGER role
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle(ARTICLE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('HELPDESK_MANAGER');
  });

  it('allows HELPDESK_MANAGER to publish', async () => {
    mockStaffAuthorize.mockResolvedValue({
      session: {
        staffUserId: 'staff-manager-001',
        displayName: 'Manager',
        isPlatformStaff: true as const,
        platformRoles: ['HELPDESK_MANAGER' as const],
      },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID, version: 1 }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle(ARTICLE_ID);
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUBLISHED' })
    );
  });

  it('allows ADMIN to publish', async () => {
    mockStaffAuthorize.mockResolvedValue({
      session: {
        staffUserId: 'staff-admin-001',
        displayName: 'Admin',
        isPlatformStaff: true as const,
        platformRoles: ['ADMIN' as const],
      },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelect.mockReturnValue(makeSelectChain([{ id: ARTICLE_ID, version: 2 }]));
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { publishKbArticle } = await import('../kb-articles');
    const result = await publishKbArticle(ARTICLE_ID);
    expect(result.success).toBe(true);
  });
});
