import { describe, it, expect } from 'vitest';
import {
  calculateCombinedShipping,
  type CombinedShippingInput,
} from '../combined-shipping';

describe('Combined Shipping Calculator', () => {
  describe('Mode: NONE', () => {
    it('returns sum of individual shipping costs', () => {
      const input: CombinedShippingInput = {
        mode: 'NONE',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1200);
      expect(result.savingsCents).toBe(0);
      expect(result.mode).toBe('NONE');
    });

    it('handles quantity > 1 correctly', () => {
      const input: CombinedShippingInput = {
        mode: 'NONE',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 3 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1500);
      expect(result.savingsCents).toBe(0);
    });

    it('returns zero for empty items', () => {
      const input: CombinedShippingInput = {
        mode: 'NONE',
        items: [],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(0);
      expect(result.savingsCents).toBe(0);
    });
  });

  describe('Mode: FLAT', () => {
    it('applies flat rate regardless of item count', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
          { listingId: 'c', shippingCents: 600, quantity: 1 },
        ],
        flatCombinedCents: 800,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(800);
      expect(result.savingsCents).toBe(1000); // 1800 - 800
      expect(result.mode).toBe('FLAT');
    });

    it('shows no savings when flat rate equals individual', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 400, quantity: 1 },
          { listingId: 'b', shippingCents: 400, quantity: 1 },
        ],
        flatCombinedCents: 800,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(800);
      expect(result.savingsCents).toBe(0);
    });

    it('falls back to individual when flat rate not configured', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
        flatCombinedCents: null,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1200);
      expect(result.savingsCents).toBe(0);
    });

    it('distributes flat rate proportionally in breakdown', () => {
      const input: CombinedShippingInput = {
        mode: 'FLAT',
        items: [
          { listingId: 'a', shippingCents: 300, quantity: 1 }, // 30%
          { listingId: 'b', shippingCents: 700, quantity: 1 }, // 70%
        ],
        flatCombinedCents: 1000,
      };

      const result = calculateCombinedShipping(input);

      const itemA = result.itemBreakdown.find((i) => i.listingId === 'a');
      const itemB = result.itemBreakdown.find((i) => i.listingId === 'b');

      expect(itemA?.adjustedCents).toBe(300); // 30% of 1000
      expect(itemB?.adjustedCents).toBe(700); // 70% of 1000
    });
  });

  describe('Mode: PER_ADDITIONAL', () => {
    it('charges full shipping for first item, reduced for additional', () => {
      const input: CombinedShippingInput = {
        mode: 'PER_ADDITIONAL',
        items: [
          { listingId: 'a', shippingCents: 800, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        additionalItemCents: 200,
      };

      const result = calculateCombinedShipping(input);

      // Most expensive (800) ships first, second pays 200
      expect(result.totalShippingCents).toBe(1000);
      expect(result.savingsCents).toBe(300); // 1300 - 1000
      expect(result.mode).toBe('PER_ADDITIONAL');
    });

    it('sorts items by shipping cost descending (most expensive first)', () => {
      const input: CombinedShippingInput = {
        mode: 'PER_ADDITIONAL',
        items: [
          { listingId: 'cheap', shippingCents: 300, quantity: 1 },
          { listingId: 'expensive', shippingCents: 900, quantity: 1 },
          { listingId: 'medium', shippingCents: 500, quantity: 1 },
        ],
        additionalItemCents: 100,
      };

      const result = calculateCombinedShipping(input);

      // expensive (900) + medium (100) + cheap (100) = 1100
      expect(result.totalShippingCents).toBe(1100);
      expect(result.savingsCents).toBe(600); // 1700 - 1100
    });

    it('handles multiple quantities correctly', () => {
      const input: CombinedShippingInput = {
        mode: 'PER_ADDITIONAL',
        items: [
          { listingId: 'a', shippingCents: 600, quantity: 3 },
        ],
        additionalItemCents: 150,
      };

      const result = calculateCombinedShipping(input);

      // First unit: 600, remaining 2 units: 150 each = 600 + 300 = 900
      expect(result.totalShippingCents).toBe(900);
      expect(result.savingsCents).toBe(900); // 1800 - 900
    });

    it('handles mixed quantities', () => {
      const input: CombinedShippingInput = {
        mode: 'PER_ADDITIONAL',
        items: [
          { listingId: 'a', shippingCents: 700, quantity: 2 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        additionalItemCents: 200,
      };

      const result = calculateCombinedShipping(input);

      // Item A (most expensive): first unit 700, second unit 200 = 900
      // Item B: 200
      // Total: 1100
      expect(result.totalShippingCents).toBe(1100);
      expect(result.savingsCents).toBe(800); // 1900 - 1100
    });

    it('falls back to individual when additionalItemCents not configured', () => {
      const input: CombinedShippingInput = {
        mode: 'PER_ADDITIONAL',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
        additionalItemCents: null,
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1000);
      expect(result.savingsCents).toBe(0);
    });
  });
});
