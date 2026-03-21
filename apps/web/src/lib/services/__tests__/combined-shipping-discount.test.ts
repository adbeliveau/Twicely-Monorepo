import { describe, it, expect } from 'vitest';
import {
  calculateCombinedShipping,
  type CombinedShippingInput,
} from '../combined-shipping';

describe('Combined Shipping Calculator — discounts and edge cases', () => {
  describe('Mode: AUTO_DISCOUNT', () => {
    it('applies percentage discount when minimum items met', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        autoDiscountPercent: 20,
        autoDiscountMinItems: 2,
      };

      const result = calculateCombinedShipping(input);

      // 1000 * 0.8 = 800
      expect(result.totalShippingCents).toBe(800);
      expect(result.savingsCents).toBe(200);
      expect(result.mode).toBe('AUTO_DISCOUNT');
    });

    it('no discount when minimum items not met', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
        ],
        autoDiscountPercent: 20,
        autoDiscountMinItems: 2,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(500);
      expect(result.savingsCents).toBe(0);
    });

    it('counts quantity toward minimum items', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 400, quantity: 3 },
        ],
        autoDiscountPercent: 25,
        autoDiscountMinItems: 3,
      };

      const result = calculateCombinedShipping(input);

      // 1200 * 0.75 = 900
      expect(result.totalShippingCents).toBe(900);
      expect(result.savingsCents).toBe(300);
    });

    it('clamps discount percent to 10-75% range', () => {
      // Test lower bound
      const inputLow: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 1000, quantity: 1 },
          { listingId: 'b', shippingCents: 1000, quantity: 1 },
        ],
        autoDiscountPercent: 5, // Below 10%
        autoDiscountMinItems: 2,
      };

      const resultLow = calculateCombinedShipping(inputLow);
      // Clamped to 10%: 2000 * 0.9 = 1800
      expect(resultLow.totalShippingCents).toBe(1800);

      // Test upper bound
      const inputHigh: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 1000, quantity: 1 },
          { listingId: 'b', shippingCents: 1000, quantity: 1 },
        ],
        autoDiscountPercent: 90, // Above 75%
        autoDiscountMinItems: 2,
      };

      const resultHigh = calculateCombinedShipping(inputHigh);
      // Clamped to 75%: 2000 * 0.25 = 500
      expect(resultHigh.totalShippingCents).toBe(500);
    });

    it('defaults to minItems=2 when not specified', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        autoDiscountPercent: 20,
        // autoDiscountMinItems not specified
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(800); // 20% off applied
      expect(result.savingsCents).toBe(200);
    });

    it('no discount when percent is zero or negative', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        autoDiscountPercent: 0,
        autoDiscountMinItems: 2,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1000);
      expect(result.savingsCents).toBe(0);
    });
  });

  describe('Mode: QUOTED', () => {
    it('falls back to individual shipping (D2.2 placeholder)', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1200);
      expect(result.savingsCents).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('single item returns individual shipping', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
        ],
        flatCombinedCents: 300,
      };

      const result = calculateCombinedShipping(input);

      // Single item doesn't trigger combination
      expect(result.totalShippingCents).toBe(500);
      expect(result.savingsCents).toBe(0);
    });

    it('handles free shipping items', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 0, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        flatCombinedCents: 400,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(400);
      expect(result.savingsCents).toBe(100); // 500 - 400
    });

    it('handles all free shipping items', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 0, quantity: 1 },
          { listingId: 'b', shippingCents: 0, quantity: 1 },
        ],
        flatCombinedCents: 500,
      };

      const result = calculateCombinedShipping(input);

      // Flat rate would increase cost, so savings = 0 (not negative)
      expect(result.totalShippingCents).toBe(500);
      expect(result.savingsCents).toBe(0);
    });

    it('provides item breakdown for all modes', () => {
      const input: CombinedShippingInput = {
        mode: 'AUTO_DISCOUNT',
        items: [
          { listingId: 'a', shippingCents: 400, quantity: 2 },
          { listingId: 'b', shippingCents: 600, quantity: 1 },
        ],
        autoDiscountPercent: 20,
        autoDiscountMinItems: 2,
      };

      const result = calculateCombinedShipping(input);

      expect(result.itemBreakdown).toHaveLength(2);
      expect(result.itemBreakdown[0]?.listingId).toBe('a');
      expect(result.itemBreakdown[0]?.originalCents).toBe(800);
      expect(result.itemBreakdown[1]?.listingId).toBe('b');
      expect(result.itemBreakdown[1]?.originalCents).toBe(600);

      // Total adjusted should equal total shipping
      const totalAdjusted = result.itemBreakdown.reduce(
        (sum, item) => sum + item.adjustedCents,
        0
      );
      expect(totalAdjusted).toBe(result.totalShippingCents);
    });
  });
});
