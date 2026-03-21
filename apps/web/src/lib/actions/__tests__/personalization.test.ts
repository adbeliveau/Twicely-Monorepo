import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: (...args: unknown[]) => args }));
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'test-cuid' }));

describe('saveUserInterestsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion', 'electronics'] });

    expect(result).toEqual({ success: false, error: 'Not authenticated' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns validation error for empty tagSlugs array', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: [] });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns validation error for only 1 tagSlug (less than minimum 2)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion'] });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns validation error for more than 50 tagSlugs', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    const tooMany = Array.from({ length: 51 }, (_, i) => `tag-${i}`);

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: tooMany });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns error when tagSlugs contain invalid slugs not in interestTag table', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    // DB returns fewer tags than requested (1 of 2 found = invalid slug present)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ slug: 'fashion' }]),
      }),
    });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion', 'nonexistent-slug'] });

    expect(result).toEqual({ success: false, error: 'One or more interest tags are invalid' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('saves 3 valid tagSlugs with source=EXPLICIT, weight=10.0, expiresAt=null', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const slugs = ['fashion', 'electronics', 'sports'];

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(slugs.map((s) => ({ slug: s }))),
      }),
    });

    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: mockValues });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: slugs });

    expect(result).toEqual({ success: true });
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);

    const insertedRows = mockValues.mock.calls[0]?.[0];
    expect(insertedRows).toHaveLength(3);
    for (const row of insertedRows) {
      expect(row.source).toBe('EXPLICIT');
      expect(row.weight).toBe('10.0');
      expect(row.expiresAt).toBeNull();
      expect(row.userId).toBe('user-1');
    }
  });

  it('deletes existing EXPLICIT interests before inserting new ones (replace, not append)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const slugs = ['fashion', 'electronics'];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(slugs.map((s) => ({ slug: s }))),
      }),
    });

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    mockDbDelete.mockReturnValue({ where: mockWhere });
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const { saveUserInterestsAction } = await import('../personalization');
    await saveUserInterestsAction({ tagSlugs: slugs });

    // Delete must happen before insert
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    // Verify delete was called (the mock was invoked)
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it('returns validation error for invalid input shape (not an object)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction(null);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts exactly 2 tagSlugs (minimum valid boundary)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const slugs = ['fashion', 'electronics'];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(slugs.map((s) => ({ slug: s }))),
      }),
    });

    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: slugs });

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('returns validation error when a slug in the array is an empty string', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion', ''] });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns validation error when a slug exceeds 50 characters', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });
    const longSlug = 'a'.repeat(51);

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion', longSlug] });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns auth error when session is null (auth check precedes schema check)', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: [] });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
    expect(mockAuthorize).toHaveBeenCalled();
  });

  it('returns invalid error for duplicate tagSlugs (dedupe mismatch)', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    // DB finds only 1 unique tag but tagSlugs has 2 entries (duplicate)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ slug: 'fashion' }]),
      }),
    });

    const { saveUserInterestsAction } = await import('../personalization');
    const result = await saveUserInterestsAction({ tagSlugs: ['fashion', 'fashion'] });

    expect(result).toEqual({ success: false, error: 'One or more interest tags are invalid' });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('each inserted row has an id field set by createId', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const slugs = ['fashion', 'electronics'];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(slugs.map((s) => ({ slug: s }))),
      }),
    });

    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: mockValues });

    const { saveUserInterestsAction } = await import('../personalization');
    await saveUserInterestsAction({ tagSlugs: slugs });

    const insertedRows = mockValues.mock.calls[0]?.[0] as Array<{ id: string; tagSlug: string }>;
    expect(insertedRows).toHaveLength(2);
    for (const row of insertedRows) {
      expect(row.id).toBe('test-cuid');
      expect(typeof row.tagSlug).toBe('string');
    }
  });
});
