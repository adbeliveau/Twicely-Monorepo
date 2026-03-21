import { describe, it, expect } from 'vitest';
import { resolveQuoteFinalPrice } from '../shipping-quote-resolver';

describe('resolveQuoteFinalPrice', () => {
  describe('Seller quote lower than penalty price', () => {
    it('returns seller quote when lower than penalty price', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: 600,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = round(1000 * 0.75) = 750
      // finalShippingCents = min(600, 750) = 600
      expect(result.finalShippingCents).toBe(600);
      expect(result.usedSellerQuote).toBe(true);
      expect(result.savingsCents).toBe(400);
    });

    it('uses seller quote at zero dollars (free shipping)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: 0,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = 750; min(0, 750) = 0
      expect(result.finalShippingCents).toBe(0);
      expect(result.usedSellerQuote).toBe(true);
      expect(result.savingsCents).toBe(1000);
    });
  });

  describe('Penalty price lower than seller quote', () => {
    it('returns penalty price when lower than seller quote', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: 900,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = round(1000 * 0.75) = 750
      // finalShippingCents = min(900, 750) = 750
      expect(result.finalShippingCents).toBe(750);
      expect(result.usedSellerQuote).toBe(false);
      expect(result.savingsCents).toBe(250);
    });

    it('returns penalty price when quote equals max (no discount)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 800,
        quotedShippingCents: 800,
        penaltyDiscountPercent: 10,
      });

      // penaltyPrice = round(800 * 0.9) = 720
      // min(800, 720) = 720 => not seller quote
      expect(result.finalShippingCents).toBe(720);
      expect(result.usedSellerQuote).toBe(false);
      expect(result.savingsCents).toBe(80);
    });
  });

  describe('No seller quote (penalty-only path)', () => {
    it('returns penalty price when seller has not quoted', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: null,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = round(1000 * 0.75) = 750
      expect(result.finalShippingCents).toBe(750);
      expect(result.usedSellerQuote).toBe(false);
      expect(result.savingsCents).toBe(250);
    });

    it('computes penalty as maxShippingCents * (1 - penaltyPercent/100)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 2000,
        quotedShippingCents: null,
        penaltyDiscountPercent: 20,
      });

      // penaltyPrice = round(2000 * 0.80) = 1600
      expect(result.finalShippingCents).toBe(1600);
      expect(result.savingsCents).toBe(400);
    });
  });

  describe('Boundary values', () => {
    it('handles zero penalty discount (returns max shipping)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: null,
        penaltyDiscountPercent: 0,
      });

      // penaltyPrice = round(1000 * 1.0) = 1000
      expect(result.finalShippingCents).toBe(1000);
      expect(result.savingsCents).toBe(0);
    });

    it('handles 100% penalty discount (returns zero)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: null,
        penaltyDiscountPercent: 100,
      });

      // penaltyPrice = round(1000 * 0.0) = 0
      expect(result.finalShippingCents).toBe(0);
      expect(result.savingsCents).toBe(1000);
    });

    it('rounds to integer cents', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1001,
        quotedShippingCents: null,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = round(1001 * 0.75) = round(750.75) = 751
      expect(result.finalShippingCents).toBe(751);
      expect(Number.isInteger(result.finalShippingCents)).toBe(true);
    });

    it('sellerQuote equal to penalty price uses seller quote (tie goes to seller)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: 750,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = 750; quotedShippingCents = 750; min(750, 750) = 750
      // quotedShippingCents <= penaltyPrice => usedSellerQuote = true
      expect(result.finalShippingCents).toBe(750);
      expect(result.usedSellerQuote).toBe(true);
    });

    it('handles zero max shipping (free shipping scenario)', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 0,
        quotedShippingCents: null,
        penaltyDiscountPercent: 25,
      });

      // penaltyPrice = round(0 * 0.75) = 0
      expect(result.finalShippingCents).toBe(0);
      expect(result.savingsCents).toBe(0);
      expect(result.usedSellerQuote).toBe(false);
    });
  });

  describe('Return value shape', () => {
    it('always returns all three fields', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 500,
        quotedShippingCents: 300,
        penaltyDiscountPercent: 25,
      });

      expect(result).toHaveProperty('finalShippingCents');
      expect(result).toHaveProperty('savingsCents');
      expect(result).toHaveProperty('usedSellerQuote');
    });

    it('savingsCents is always non-negative', () => {
      // Even when penalty price > max (which should not happen in practice but is defensive)
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 1000,
        quotedShippingCents: 400,
        penaltyDiscountPercent: 25,
      });

      expect(result.savingsCents).toBeGreaterThanOrEqual(0);
    });

    it('finalShippingCents is always a non-negative integer', () => {
      const result = resolveQuoteFinalPrice({
        maxShippingCents: 999,
        quotedShippingCents: 333,
        penaltyDiscountPercent: 33,
      });

      expect(Number.isInteger(result.finalShippingCents)).toBe(true);
      expect(result.finalShippingCents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('savingsCents invariant', () => {
    it('savingsCents = maxShippingCents - finalShippingCents', () => {
      const inputs = [
        { maxShippingCents: 1000, quotedShippingCents: 600, penaltyDiscountPercent: 25 },
        { maxShippingCents: 2000, quotedShippingCents: null, penaltyDiscountPercent: 30 },
        { maxShippingCents: 500, quotedShippingCents: 450, penaltyDiscountPercent: 10 },
      ];

      for (const input of inputs) {
        const result = resolveQuoteFinalPrice(input);
        expect(result.savingsCents).toBe(input.maxShippingCents - result.finalShippingCents);
      }
    });
  });
});
