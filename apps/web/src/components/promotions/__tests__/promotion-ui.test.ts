import { describe, it, expect } from 'vitest';
import { derivePromotionStatus, type PromotionStatusData } from '../promotion-status-badge';

function createPromoData(overrides: Partial<PromotionStatusData> = {}): PromotionStatusData {
  return { isActive: true, startsAt: new Date('2024-01-01'), endsAt: null, ...overrides };
}

describe('derivePromotionStatus', () => {
  const now = new Date('2024-06-15');

  it('returns "active" when isActive, started, no end', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: null }), now)).toBe('active');
  });

  it('returns "active" when isActive, started, end in future', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2024-12-31') }), now)).toBe('active');
  });

  it('returns "paused" when isActive is false', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: false }), now)).toBe('paused');
  });

  it('returns "scheduled" when startsAt is in the future', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: new Date('2025-01-01') }), now)).toBe('scheduled');
  });

  it('returns "ended" when endsAt is in the past', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2024-03-01') }), now)).toBe('ended');
  });

  it('paused takes precedence over scheduled', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: false, startsAt: new Date('2025-01-01') }), now)).toBe('paused');
  });

  it('paused takes precedence over ended', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: false, endsAt: new Date('2024-01-01') }), now)).toBe('paused');
  });

  it('handles exact boundary: startsAt equals now → active', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: now }), now)).toBe('active');
  });

  it('handles exact boundary: endsAt equals now → ended', () => {
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: now }), now)).toBe('ended');
  });

  it('defaults now to current time if not provided', () => {
    const futureStart = new Date(Date.now() + 86400000);
    expect(derivePromotionStatus(createPromoData({ isActive: true, startsAt: futureStart }))).toBe('scheduled');
  });
});

describe('PromotionCard display helpers', () => {
  it('formatDiscount handles PERCENT_OFF', () => {
    const promo = { type: 'PERCENT_OFF', discountPercent: 20, discountAmountCents: null };
    expect(promo.discountPercent).toBe(20);
  });

  it('formatDiscount handles AMOUNT_OFF', () => {
    const promo = { type: 'AMOUNT_OFF', discountPercent: null, discountAmountCents: 1000 };
    expect((promo.discountAmountCents! / 100).toFixed(2)).toBe('10.00');
  });

  it('formatDiscount handles FREE_SHIPPING', () => {
    const promo = { type: 'FREE_SHIPPING', discountPercent: null, discountAmountCents: null };
    expect(promo.type).toBe('FREE_SHIPPING');
  });
});
