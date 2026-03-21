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

function makeDeleteChain() {
  return {
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

const CATEGORY_ID = 'cljd4bvd00002wjh07mcy26z';

// ─── updateKbCategory ─────────────────────────────────────────────────────────

describe('updateKbCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { updateKbCategory } = await import('../kb-categories');
    const result = await updateKbCategory({ categoryId: CATEGORY_ID, name: 'New Name' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('updates name when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbCategory } = await import('../kb-categories');
    const result = await updateKbCategory({ categoryId: CATEGORY_ID, name: 'Updated Name' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Name' })
    );
  });

  it('updates slug when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbCategory } = await import('../kb-categories');
    const result = await updateKbCategory({ categoryId: CATEGORY_ID, slug: 'new-slug' });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'new-slug' })
    );
  });

  it('updates isActive toggle', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbCategory } = await import('../kb-categories');
    const result = await updateKbCategory({ categoryId: CATEGORY_ID, isActive: false });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it('rejects bad slug format', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { updateKbCategory } = await import('../kb-categories');
    const result = await updateKbCategory({ categoryId: CATEGORY_ID, slug: 'Bad Slug' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('always sets updatedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain);

    const { updateKbCategory } = await import('../kb-categories');
    await updateKbCategory({ categoryId: CATEGORY_ID, name: 'Test' });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) })
    );
  });
});

// ─── deleteKbCategory ─────────────────────────────────────────────────────────

describe('deleteKbCategory', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { deleteKbCategory } = await import('../kb-categories');
    const result = await deleteKbCategory(CATEGORY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('deletes empty category when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      // First call: category exists check
      if (callCount === 1) return makeSelectChain([{ id: CATEGORY_ID }]);
      // Second call: article count = 0
      return makeSelectChain([{ cnt: 0 }]);
    });
    const deleteChain = makeDeleteChain();
    mockDelete.mockReturnValue(deleteChain);

    const { deleteKbCategory } = await import('../kb-categories');
    const result = await deleteKbCategory(CATEGORY_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('rejects delete when articles exist in category', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      // First call: category exists
      if (callCount === 1) return makeSelectChain([{ id: CATEGORY_ID }]);
      // Second call: 3 articles exist
      return makeSelectChain([{ cnt: 3 }]);
    });

    const { deleteKbCategory } = await import('../kb-categories');
    const result = await deleteKbCategory(CATEGORY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot delete category with existing articles');
  });

  it('returns not found for nonexistent category', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { deleteKbCategory } = await import('../kb-categories');
    const result = await deleteKbCategory(CATEGORY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});
