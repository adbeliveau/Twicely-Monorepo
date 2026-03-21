import { describe, it, expect } from 'vitest';
import { calculateAuthCostSplit } from '../cost-split';

describe('calculateAuthCostSplit', () => {
  it('buyer-initiated authentic: splits 50/50', () => {
    const result = calculateAuthCostSplit('BUYER', 'AUTHENTICATED', 3999);
    expect(result.totalFeeCents).toBe(3999);
    expect(result.buyerShareCents).toBe(1999);
    expect(result.sellerShareCents).toBe(2000);
    expect(result.buyerShareCents + result.sellerShareCents).toBe(3999);
  });

  it('buyer-initiated authentic: handles odd cent amounts (no rounding loss)', () => {
    const result = calculateAuthCostSplit('BUYER', 'AUTHENTICATED', 101);
    expect(result.buyerShareCents).toBe(50);
    expect(result.sellerShareCents).toBe(51);
    expect(result.buyerShareCents + result.sellerShareCents).toBe(101);
  });

  it('buyer-initiated authentic: even amount splits evenly', () => {
    const result = calculateAuthCostSplit('BUYER', 'AUTHENTICATED', 4000);
    expect(result.buyerShareCents).toBe(2000);
    expect(result.sellerShareCents).toBe(2000);
  });

  it('seller-initiated authentic: seller pays full amount', () => {
    const result = calculateAuthCostSplit('SELLER', 'AUTHENTICATED', 3999);
    expect(result.totalFeeCents).toBe(3999);
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(3999);
  });

  it('counterfeit: seller pays full amount regardless of initiator (buyer-initiated)', () => {
    const result = calculateAuthCostSplit('BUYER', 'COUNTERFEIT', 3999);
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(3999);
  });

  it('counterfeit: seller pays full amount regardless of initiator (seller-initiated)', () => {
    const result = calculateAuthCostSplit('SELLER', 'COUNTERFEIT', 3999);
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(3999);
  });

  it('inconclusive: Twicely absorbs (buyer=0, seller=0)', () => {
    const result = calculateAuthCostSplit('BUYER', 'INCONCLUSIVE', 3999);
    expect(result.totalFeeCents).toBe(3999);
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(0);
  });

  it('inconclusive: seller-initiated also absorbed by Twicely', () => {
    const result = calculateAuthCostSplit('SELLER', 'INCONCLUSIVE', 3999);
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(0);
  });

  it('buyer-initiated counterfeit: buyer refunded (buyer=0, seller=full)', () => {
    const result = calculateAuthCostSplit('BUYER', 'COUNTERFEIT', 3999);
    // buyer pays nothing; seller pays full
    expect(result.buyerShareCents).toBe(0);
    expect(result.sellerShareCents).toBe(3999);
  });
});
