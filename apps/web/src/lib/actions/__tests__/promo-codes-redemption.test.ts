import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {},
}));

vi.mock('@twicely/stripe/promo-codes', () => ({
  deactivateStripePromotionCode: vi.fn(),
}));

import { recordPromoCodeRedemption } from '../promo-codes-helpers';
import { db } from '@twicely/db';

const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);

// ─── recordPromoCodeRedemption ──────────────────────────────────────────────

describe('recordPromoCodeRedemption', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
  });

  it('inserts a redemption record', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'store', 500, 3, 'promo-stripe-1');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('increments usageCount on the promo code', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'store', 500, 3, 'promo-stripe-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('performs two DB operations: insert redemption + update usageCount', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'lister', 1000, 6, 'promo-stripe-2');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
