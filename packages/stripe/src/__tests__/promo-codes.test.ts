import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCouponsCreate, mockPromotionCodesCreate, mockPromotionCodesUpdate } = vi.hoisted(() => ({
  mockCouponsCreate: vi.fn(),
  mockPromotionCodesCreate: vi.fn(),
  mockPromotionCodesUpdate: vi.fn(),
}));

vi.mock('../server', () => ({
  stripe: {
    coupons: {
      create: (...args: unknown[]) => mockCouponsCreate(...args),
    },
    promotionCodes: {
      create: (...args: unknown[]) => mockPromotionCodesCreate(...args),
      update: (...args: unknown[]) => mockPromotionCodesUpdate(...args),
    },
  },
}));

import { syncPromoCodeToStripe, deactivateStripePromotionCode } from '../promo-codes';

function makePromoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-test-1',
    code: 'SAVE10',
    discountType: 'PERCENTAGE',
    discountValue: 1000,
    durationMonths: 3,
    expiresAt: null,
    usageLimit: null,
    ...overrides,
  } as never;
}

// ─── syncPromoCodeToStripe ────────────────────────────────────────────────────

describe('syncPromoCodeToStripe', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a Stripe Coupon with percent_off for PERCENTAGE type', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow());

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: 10 })
    );
    expect(mockCouponsCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: expect.anything() })
    );
  });

  it('divides discountValue by 100 to get percent_off (BPS to %)', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    // 2000 BPS = 20% discount
    await syncPromoCodeToStripe(makePromoRow({ discountValue: 2000 }));

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: 20 })
    );
  });

  it('creates a Stripe Coupon with amount_off and currency=usd for FIXED type', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ discountType: 'FIXED', discountValue: 500 }));

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: 500, currency: 'usd' })
    );
    expect(mockCouponsCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: expect.anything() })
    );
  });

  it('sets coupon duration to repeating with correct duration_in_months', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ durationMonths: 6 }));

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 'repeating', duration_in_months: 6 })
    );
  });

  it('sets coupon name to the promo code string', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ code: 'LAUNCH50' }));

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'LAUNCH50' })
    );
  });

  it('includes twicelyPromoCodeId in coupon metadata', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ id: 'promo-test-1' }));

    expect(mockCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { twicelyPromoCodeId: 'promo-test-1' } })
    );
  });

  it('creates a PromotionCode with the correct code string', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ code: 'LAUNCH50' }));

    expect(mockPromotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LAUNCH50' })
    );
  });

  it('does not set expires_at when expiresAt is null', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ expiresAt: null }));

    const call = mockPromotionCodesCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('expires_at');
  });

  it('sets expires_at as unix timestamp when expiresAt is set', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    const futureDate = new Date('2028-01-01T00:00:00.000Z');
    const expectedUnix = Math.floor(futureDate.getTime() / 1000);

    await syncPromoCodeToStripe(makePromoRow({ expiresAt: futureDate }));

    expect(mockPromotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: expectedUnix })
    );
  });

  it('does not set max_redemptions when usageLimit is null', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ usageLimit: null }));

    const call = mockPromotionCodesCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('max_redemptions');
  });

  it('sets max_redemptions when usageLimit is provided', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-abc' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-code-abc' });

    await syncPromoCodeToStripe(makePromoRow({ usageLimit: 100 }));

    expect(mockPromotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_redemptions: 100 })
    );
  });

  it('returns stripeCouponId and stripePromotionCodeId from Stripe response', async () => {
    mockCouponsCreate.mockResolvedValue({ id: 'coupon-xyz' });
    mockPromotionCodesCreate.mockResolvedValue({ id: 'promo-xyz' });

    const result = await syncPromoCodeToStripe(makePromoRow());

    expect(result).toEqual({
      stripeCouponId: 'coupon-xyz',
      stripePromotionCodeId: 'promo-xyz',
    });
  });
});

// ─── deactivateStripePromotionCode ────────────────────────────────────────────

describe('deactivateStripePromotionCode', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls stripe.promotionCodes.update with active=false', async () => {
    mockPromotionCodesUpdate.mockResolvedValue({ id: 'promo-xyz', active: false });

    await deactivateStripePromotionCode('promo-xyz');

    expect(mockPromotionCodesUpdate).toHaveBeenCalledWith('promo-xyz', { active: false });
  });

  it('passes through the correct promotion code ID', async () => {
    mockPromotionCodesUpdate.mockResolvedValue({ id: 'promo-abc', active: false });

    await deactivateStripePromotionCode('promo-abc');

    expect(mockPromotionCodesUpdate).toHaveBeenCalledWith('promo-abc', expect.any(Object));
  });
});
