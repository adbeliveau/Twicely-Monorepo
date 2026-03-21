import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', status: 'status', availableQuantity: 'available_quantity', ownerUserId: 'owner_user_id' },
  sellerProfile: { userId: 'user_id', vacationMode: 'vacation_mode', vacationModeType: 'vacation_mode_type' },
}));

import { db } from '@twicely/db';
import { checkListingAvailability } from '../availability';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LISTING_ID = 'lst-reserved-001';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkListingAvailability — RESERVED status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unavailable with reason RESERVED when listing status is RESERVED', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectChain([
          { id: LISTING_ID, status: 'RESERVED', availableQuantity: 1, ownerUserId: 'seller-001' },
        ]) as never,
      );

    const result = await checkListingAvailability(LISTING_ID, 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('RESERVED');
  });

  it('returns availableQuantity 0 for RESERVED listing', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectChain([
          { id: LISTING_ID, status: 'RESERVED', availableQuantity: 3, ownerUserId: 'seller-001' },
        ]) as never,
      );

    const result = await checkListingAvailability(LISTING_ID, 1);

    expect(result.availableQuantity).toBe(0);
  });
});
