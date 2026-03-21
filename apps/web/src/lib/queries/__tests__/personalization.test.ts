import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

describe('getInterestTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns only active tags', async () => {
    const activeTags = [
      { id: 'tag-1', slug: 'fashion', label: 'Fashion', group: 'fashion', isActive: true, displayOrder: 0 },
      { id: 'tag-2', slug: 'electronics', label: 'Electronics', group: 'electronics', isActive: true, displayOrder: 1 },
    ];

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(activeTags),
        }),
      }),
    });

    const { getInterestTags } = await import('../personalization');
    const result = await getInterestTags();

    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe('fashion');
    expect(result[1]?.slug).toBe('electronics');
  });

  it('returns tags in displayOrder order', async () => {
    const tags = [
      { id: 'tag-1', slug: 'aaa', label: 'AAA', group: 'fashion', isActive: true, displayOrder: 0 },
      { id: 'tag-2', slug: 'bbb', label: 'BBB', group: 'fashion', isActive: true, displayOrder: 1 },
      { id: 'tag-3', slug: 'ccc', label: 'CCC', group: 'electronics', isActive: true, displayOrder: 0 },
    ];

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(tags),
        }),
      }),
    });

    const { getInterestTags } = await import('../personalization');
    const result = await getInterestTags();

    expect(result).toHaveLength(3);
    expect(result[0]?.slug).toBe('aaa');
    expect(result[1]?.slug).toBe('bbb');
  });

  it('returns empty array when no active tags exist', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { getInterestTags } = await import('../personalization');
    const result = await getInterestTags();

    expect(result).toHaveLength(0);
  });
});

describe('getUserExplicitInterests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns slug array for user with EXPLICIT interests', async () => {
    const rows = [{ tagSlug: 'fashion' }, { tagSlug: 'electronics' }];

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });

    const { getUserExplicitInterests } = await import('../personalization');
    const result = await getUserExplicitInterests('user-1');

    expect(result).toEqual(['fashion', 'electronics']);
  });

  it('returns empty array for user with no EXPLICIT interests', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const { getUserExplicitInterests } = await import('../personalization');
    const result = await getUserExplicitInterests('user-with-no-interests');

    expect(result).toEqual([]);
  });
});
