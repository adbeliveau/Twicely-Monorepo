import { describe, it, expect } from 'vitest';
import {
  calculateCombinedShipping,
  type CombinedShippingInput,
} from '../combined-shipping';

describe('Combined Shipping — QUOTED mode', () => {
  describe('Auth hold ceiling at checkout', () => {
    it('returns individual total as hold ceiling with mode QUOTED', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1200);
      expect(result.mode).toBe('QUOTED');
    });

    it('returns zero savings (savings happen after seller quotes)', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.savingsCents).toBe(0);
    });

    it('three-item order uses full individual sum as ceiling', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 400, quantity: 1 },
          { listingId: 'b', shippingCents: 600, quantity: 1 },
          { listingId: 'c', shippingCents: 300, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(1300);
      expect(result.savingsCents).toBe(0);
    });
  });

  describe('Item breakdown', () => {
    it('returns item breakdown with adjustedCents equal to originalCents', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 1 },
          { listingId: 'b', shippingCents: 700, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.itemBreakdown).toHaveLength(2);
      for (const item of result.itemBreakdown) {
        expect(item.adjustedCents).toBe(item.originalCents);
      }
    });

    it('breakdown originalCents reflects quantity multiplication', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 2 },
          { listingId: 'b', shippingCents: 300, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.itemBreakdown[0]?.originalCents).toBe(1000); // 500 * 2
      expect(result.itemBreakdown[1]?.originalCents).toBe(300);  // 300 * 1
    });

    it('breakdown listingIds are preserved', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'listing-abc', shippingCents: 400, quantity: 1 },
          { listingId: 'listing-xyz', shippingCents: 600, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.itemBreakdown[0]?.listingId).toBe('listing-abc');
      expect(result.itemBreakdown[1]?.listingId).toBe('listing-xyz');
    });
  });

  describe('Single-item passthrough', () => {
    it('skips quote for single item (returns individual shipping)', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [{ listingId: 'a', shippingCents: 800, quantity: 1 }],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(800);
      expect(result.savingsCents).toBe(0);
    });

    it('returns QUOTED mode even for single item', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [{ listingId: 'a', shippingCents: 800, quantity: 1 }],
      };

      const result = calculateCombinedShipping(input);

      expect(result.mode).toBe('QUOTED');
    });
  });

  describe('Quantity handling', () => {
    it('handles quantity > 1 for multi-item orders', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 500, quantity: 2 },
          { listingId: 'b', shippingCents: 300, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      // 500 * 2 + 300 * 1 = 1300
      expect(result.totalShippingCents).toBe(1300);
      expect(result.mode).toBe('QUOTED');
      expect(result.savingsCents).toBe(0);
    });

    it('single listing with quantity 2 does NOT trigger combination', () => {
      // totalQuantity = 2, but items.length would still be 1 for single listing
      // However single item check uses totalQuantity <= 1, so quantity=2 of 1 listing passes through
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [{ listingId: 'a', shippingCents: 500, quantity: 2 }],
      };

      const result = calculateCombinedShipping(input);

      // totalQuantity=2 > 1 AND items.length=1 not 0, so combination IS triggered
      // QUOTED mode returns individual total regardless
      expect(result.totalShippingCents).toBe(1000); // 500 * 2
      expect(result.savingsCents).toBe(0);
    });
  });

  describe('Free shipping edge cases', () => {
    it('handles all-free-shipping items', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 0, quantity: 1 },
          { listingId: 'b', shippingCents: 0, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(0);
      expect(result.savingsCents).toBe(0);
      expect(result.mode).toBe('QUOTED');
    });

    it('handles mixed free and paid shipping', () => {
      const input: CombinedShippingInput = {
        mode: 'QUOTED',
        items: [
          { listingId: 'a', shippingCents: 0, quantity: 1 },
          { listingId: 'b', shippingCents: 500, quantity: 1 },
        ],
      };

      const result = calculateCombinedShipping(input);

      expect(result.totalShippingCents).toBe(500);
      expect(result.savingsCents).toBe(0);
    });
  });
});
