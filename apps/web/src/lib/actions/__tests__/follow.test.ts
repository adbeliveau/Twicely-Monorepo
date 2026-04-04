import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockAuthorize = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSelectEmpty() {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
}

function mockSelectFound(row: object) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([row]),
      }),
    }),
  });
}

function mockDeleteSuccess() {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

function mockInsertSuccess() {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

// ─── toggleFollow tests ───────────────────────────────────────────────────────

describe('toggleFollow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: null });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm1a2b3c4d5e6f7g8h9i0j1k');
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns error when following yourself', async () => {
    const userId = 'clm1a2b3c4d5e6f7g8h9i0j1k';
    mockAuthorize.mockResolvedValue({
      session: { userId },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow(userId);
    expect(result).toEqual({ success: false, error: 'Cannot follow yourself' });
  });

  it('creates follow record when not already following', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelectEmpty();
    mockInsertSuccess();
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('deletes follow record when already following', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelectFound({ id: 'existing-follow-id' });
    mockDeleteSuccess();
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns isFollowing: true after creating follow', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelectEmpty();
    mockInsertSuccess();
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result.isFollowing).toBe(true);
  });

  it('returns isFollowing: false after deleting follow', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelectFound({ id: 'existing-follow-id' });
    mockDeleteSuccess();
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result.isFollowing).toBe(false);
  });

  it('revalidates /st path on success', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockSelectEmpty();
    mockInsertSuccess();
    const { toggleFollow } = await import('../follow');
    await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/st');
  });

  it('returns error for invalid (non-cuid2) sellerUserId', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('not-a-valid-cuid2');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns Forbidden when CASL denies', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(false) },
    });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result).toEqual({ success: false, error: 'Forbidden' });
  });

  it('rejects invalid cuid2 sellerUserId after authorize', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('not-a-cuid2');
    expect(result.success).toBe(false);
    expect(mockAuthorize).toHaveBeenCalled();
  });

  it('returns error for empty string sellerUserId', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const { toggleFollow } = await import('../follow');
    const result = await toggleFollow('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── getIsFollowing tests ─────────────────────────────────────────────────────

describe('getIsFollowing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns true when following', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' } });
    mockSelectFound({ id: 'follow-id' });
    const { getIsFollowing } = await import('../follow');
    const result = await getIsFollowing('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result).toBe(true);
  });

  it('returns false when not following', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'clm1a2b3c4d5e6f7g8h9i0j1k' } });
    mockSelectEmpty();
    const { getIsFollowing } = await import('../follow');
    const result = await getIsFollowing('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result).toBe(false);
  });

  it('returns false when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });
    const { getIsFollowing } = await import('../follow');
    const result = await getIsFollowing('clm9z8y7x6w5v4u3t2s1r0q9p');
    expect(result).toBe(false);
  });
});
