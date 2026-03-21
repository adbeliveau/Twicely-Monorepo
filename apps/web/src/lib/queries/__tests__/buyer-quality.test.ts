import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getBuyerQualityTier } from '../buyer-quality';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

describe('getBuyerQualityTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no reviews exist', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ avgRating: null, count: 0 }]),
      }),
    } as never);

    const result = await getBuyerQualityTier('buyer1');

    expect(result).toBeNull();
  });

  it('returns GREEN when fewer than 3 reviews exist', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ avgRating: 3.0, count: 2 }]),
      }),
    } as never);

    const result = await getBuyerQualityTier('buyer1');

    expect(result).toBe('GREEN');
  });

  it('returns GREEN when avg >= 4.0', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ avgRating: 4.2, count: 5 }]),
      }),
    } as never);

    const result = await getBuyerQualityTier('buyer1');

    expect(result).toBe('GREEN');
  });

  it('returns YELLOW when avg >= 2.5 and < 4.0', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ avgRating: 3.1, count: 5 }]),
      }),
    } as never);

    const result = await getBuyerQualityTier('buyer1');

    expect(result).toBe('YELLOW');
  });

  it('returns RED when avg < 2.5', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ avgRating: 2.0, count: 5 }]),
      }),
    } as never);

    const result = await getBuyerQualityTier('buyer1');

    expect(result).toBe('RED');
  });
});
