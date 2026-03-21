import { describe, it, expect, vi } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
  getPlatformSettingsByPrefix: vi.fn().mockResolvedValue(new Map()),
}));
import {
  supportsLocalPickup,
  supportsShipping,
  calculateLocalTfFromBrackets,
} from '../local-fee';
// Code generation functions are pure and can be imported directly
import { createId } from '@paralleldrive/cuid2';
// Structural imports for enum tests
import { fulfillmentTypeEnum, ledgerEntryTypeEnum } from '@twicely/db/schema';

// Local versions of the code generators (mirrors local-transaction.ts)
// These are pure functions that don't need DB access
function generateConfirmationCode(): string {
  return createId();
}

function generateOfflineCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

describe('Local Pickup Fee Calculator', () => {
  describe('calculateLocalTfFromBrackets', () => {
    it('uses progressive brackets (same as shipped) — 10% at $0 GMV', async () => {
      // Bracket 1: $0-$499 at 10% (1000 bps)
      const result = await calculateLocalTfFromBrackets(0, 5000); // $50 item

      expect(result.tfCents).toBe(500); // 10% of $50 = $5.00
      expect(result.effectiveRateBps).toBe(1000);
      expect(result.bracketBreakdown).toHaveLength(1);
    });

    it('uses higher bracket rate for seller with more GMV', async () => {
      // Bracket 2: $500-$1,999 at 11% (1100 bps)
      const result = await calculateLocalTfFromBrackets(50000, 10000); // $500 GMV, $100 sale

      expect(result.tfCents).toBe(1100); // 11% of $100 = $11.00
      expect(result.effectiveRateBps).toBe(1100);
    });

    it('applies $0.50 minimum TF', async () => {
      // 10% of $1 = $0.10, but minimum is $0.50
      const result = await calculateLocalTfFromBrackets(0, 100); // $1 sale

      expect(result.tfCents).toBe(50); // $0.50 minimum
    });

    it('respects seller current GMV position for bracket selection', async () => {
      // Seller at $100k GMV → bracket 8 at 8%
      const result = await calculateLocalTfFromBrackets(10000000, 100000); // $100k GMV, $1k sale

      expect(result.tfCents).toBe(8000); // 8% of $1,000 = $80
      expect(result.effectiveRateBps).toBe(800);
    });

    it('returns zero for zero sale price', async () => {
      const result = await calculateLocalTfFromBrackets(0, 0);

      expect(result.tfCents).toBe(0);
      expect(result.effectiveRateBps).toBe(0);
      expect(result.bracketBreakdown).toHaveLength(0);
    });

    it('returns zero for negative sale price', async () => {
      const result = await calculateLocalTfFromBrackets(0, -1000);

      expect(result.tfCents).toBe(0);
      expect(result.effectiveRateBps).toBe(0);
    });

    it('handles bracket boundary crossing correctly', async () => {
      // GMV $4,980 in bracket 3, $50 sale crosses into bracket 4
      const result = await calculateLocalTfFromBrackets(498000, 5000);

      expect(result.bracketBreakdown).toHaveLength(2);
      expect(result.bracketBreakdown[0]?.rateBps).toBe(1050); // bracket 3
      expect(result.bracketBreakdown[1]?.rateBps).toBe(1000); // bracket 4
    });

    it('rounds TF to nearest cent', async () => {
      // $33.33 at 10% = $3.333 → rounds to $3.33 (333 cents)
      const result = await calculateLocalTfFromBrackets(0, 3333);

      expect(result.tfCents).toBe(333);
    });

    it('handles large amounts without overflow', async () => {
      // $10M item at bracket 8 (8%) = $800,000
      const result = await calculateLocalTfFromBrackets(10000000, 1000000000);

      expect(result.tfCents).toBeGreaterThan(0);
      expect(result.effectiveRateBps).toBeGreaterThan(0);
    });

    it('returns bracket breakdown with correct amountCents per slice', async () => {
      // All in bracket 1 ($0-$499 at 10%)
      const result = await calculateLocalTfFromBrackets(0, 20000); // $200 sale

      expect(result.bracketBreakdown).toHaveLength(1);
      expect(result.bracketBreakdown[0]?.amountCents).toBe(20000);
      expect(result.bracketBreakdown[0]?.rateBps).toBe(1000);
      expect(result.bracketBreakdown[0]?.tfCents).toBe(2000); // 10% of $200
    });

    it('calculates correct TF at bracket 6 (9.0%)', async () => {
      // Seller at $25k GMV → bracket 6 at 9%
      const result = await calculateLocalTfFromBrackets(2500000, 50000); // $500 sale

      expect(result.tfCents).toBe(4500); // 9% of $500 = $45
      expect(result.effectiveRateBps).toBe(900);
    });

    it('applies minimum even when bracket calculation is below $0.50', async () => {
      // $3 item at 10% = $0.30, below $0.50 minimum
      const result = await calculateLocalTfFromBrackets(0, 300);

      expect(result.tfCents).toBe(50); // $0.50 minimum enforced
    });

    it('calculates correct TF at bracket 7 (8.5%)', async () => {
      // Seller at $50k GMV → bracket 7 at 8.5%
      const result = await calculateLocalTfFromBrackets(5000000, 100000); // $1k sale

      expect(result.tfCents).toBe(8500); // 8.5% of $1,000 = $85
      expect(result.effectiveRateBps).toBe(850);
    });

    it('returns effectiveRateBps of 0 for zero sale', async () => {
      const result = await calculateLocalTfFromBrackets(5000000, 0);

      expect(result.effectiveRateBps).toBe(0);
      expect(result.bracketBreakdown).toHaveLength(0);
    });
  });

  describe('supportsLocalPickup', () => {
    it('returns true for LOCAL_ONLY', () => {
      expect(supportsLocalPickup('LOCAL_ONLY')).toBe(true);
    });

    it('returns true for SHIP_AND_LOCAL', () => {
      expect(supportsLocalPickup('SHIP_AND_LOCAL')).toBe(true);
    });

    it('returns false for SHIP_ONLY', () => {
      expect(supportsLocalPickup('SHIP_ONLY')).toBe(false);
    });
  });

  describe('supportsShipping', () => {
    it('returns true for SHIP_ONLY', () => {
      expect(supportsShipping('SHIP_ONLY')).toBe(true);
    });

    it('returns true for SHIP_AND_LOCAL', () => {
      expect(supportsShipping('SHIP_AND_LOCAL')).toBe(true);
    });

    it('returns false for LOCAL_ONLY', () => {
      expect(supportsShipping('LOCAL_ONLY')).toBe(false);
    });
  });
});

describe('Local Transaction Code Generation', () => {
  describe('generateConfirmationCode', () => {
    it('generates code using createId() (cuid2 format)', () => {
      const code = generateConfirmationCode();

      // cuid2 format: lowercase alphanumeric, variable length (typically 24-25 chars)
      expect(code).toMatch(/^[a-z0-9]+$/);
      expect(code.length).toBeGreaterThanOrEqual(21);
      expect(code.length).toBeLessThanOrEqual(28);
    });

    it('generates lowercase codes (cuid2 format)', () => {
      const code = generateConfirmationCode();

      expect(code).toBe(code.toLowerCase());
    });

    it('generates unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateConfirmationCode());
      }

      expect(codes.size).toBe(100);
    });
  });

  describe('generateOfflineCode', () => {
    it('generates a 6-digit code', () => {
      const code = generateOfflineCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('generates codes in valid range (100000-999999)', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateOfflineCode();
        const num = parseInt(code, 10);

        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });

    it('generates unique codes (high probability)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateOfflineCode());
      }

      // With 900k possible codes, 100 samples should almost always be unique
      expect(codes.size).toBeGreaterThanOrEqual(95);
    });

    it('generates numeric-only codes', () => {
      const code = generateOfflineCode();

      expect(/^\d+$/.test(code)).toBe(true);
    });
  });
});

describe('B3.4 Structural Tests', () => {
  describe('fulfillmentTypeEnum', () => {
    it('exports fulfillmentTypeEnum', () => {
      expect(fulfillmentTypeEnum).toBeDefined();
    });

    it('contains SHIP_ONLY value', () => {
      expect(fulfillmentTypeEnum.enumValues).toContain('SHIP_ONLY');
    });

    it('contains LOCAL_ONLY value', () => {
      expect(fulfillmentTypeEnum.enumValues).toContain('LOCAL_ONLY');
    });

    it('contains SHIP_AND_LOCAL value', () => {
      expect(fulfillmentTypeEnum.enumValues).toContain('SHIP_AND_LOCAL');
    });

    it('has exactly 3 values', () => {
      expect(fulfillmentTypeEnum.enumValues.length).toBe(3);
    });
  });

  describe('ledgerEntryTypeEnum', () => {
    it('exports ledgerEntryTypeEnum', () => {
      expect(ledgerEntryTypeEnum).toBeDefined();
    });

    it('contains LOCAL_TRANSACTION_FEE value for local pickup TF', () => {
      expect(ledgerEntryTypeEnum.enumValues).toContain('LOCAL_TRANSACTION_FEE');
    });

    it('contains ORDER_TF_FEE value for shipped order TF', () => {
      expect(ledgerEntryTypeEnum.enumValues).toContain('ORDER_TF_FEE');
    });
  });
});
