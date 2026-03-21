import { describe, it, expect, vi } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));
import {
  calculateTf,
  getEffectiveRate,
  DEFAULT_TF_BRACKETS,
} from '../tf-calculator';

describe('calculateTf', () => {
  it('charges 10% for seller in bracket 1 (GMV $0, sale $100)', () => {
    // Bracket 1: $0-$499 at 10% (1000 bps)
    const result = calculateTf(0, 10000); // $100 sale
    expect(result.tfCents).toBe(1000); // $10 TF
    expect(result.effectiveRateBps).toBe(1000); // 10.00%
    expect(result.bracketBreakdown).toHaveLength(1);
    expect(result.bracketBreakdown[0]?.bracketIndex).toBe(0);
  });

  it('charges 11% for seller in bracket 2 (GMV $500, sale $100)', () => {
    // Bracket 2: $500-$1,999 at 11% (1100 bps)
    const result = calculateTf(50000, 10000); // $500 GMV, $100 sale
    expect(result.tfCents).toBe(1100); // $11 TF
    expect(result.effectiveRateBps).toBe(1100); // 11.00%
    expect(result.bracketBreakdown).toHaveLength(1);
    expect(result.bracketBreakdown[0]?.bracketIndex).toBe(1);
  });

  it('handles bracket boundary crossing (GMV $4,980, sale $50)', () => {
    // GMV $4,980 in bracket 3 (10.5%), $50 sale crosses into bracket 4 (10%)
    // Bracket 3: $2,000-$4,999 (maxCents: 499900)
    // Bracket 4: $5,000-$9,999 (maxCents: 999900)
    // $4,980 = 498000 cents, $50 = 5000 cents
    // First $19.99 ($4,999.99 - $4,980 = $19.99 = 1999 cents) at 10.5%
    // Remaining $30.01 = 3001 cents at 10.0%
    const result = calculateTf(498000, 5000);

    // Should span 2 brackets
    expect(result.bracketBreakdown).toHaveLength(2);

    // First slice: 1900 cents (remaining in bracket 3) at 10.5%
    expect(result.bracketBreakdown[0]?.bracketIndex).toBe(2); // bracket 3 (0-indexed)
    expect(result.bracketBreakdown[0]?.amountCents).toBe(1900); // 499900 - 498000
    expect(result.bracketBreakdown[0]?.rateBps).toBe(1050);

    // Second slice: 3100 cents (rest in bracket 4) at 10.0%
    expect(result.bracketBreakdown[1]?.bracketIndex).toBe(3); // bracket 4 (0-indexed)
    expect(result.bracketBreakdown[1]?.amountCents).toBe(3100); // 5000 - 1900
    expect(result.bracketBreakdown[1]?.rateBps).toBe(1000);

    // Total TF: (1900 * 1050 / 10000) + (3100 * 1000 / 10000) = 200 + 310 = 510 (rounded)
    expect(result.tfCents).toBe(510);
  });

  it('charges 8% for enterprise seller (GMV $100,000, sale $1,000)', () => {
    // Bracket 8: $100,000+ at 8% (800 bps)
    const result = calculateTf(10000000, 100000); // $100k GMV, $1k sale
    expect(result.tfCents).toBe(8000); // $80 TF
    expect(result.effectiveRateBps).toBe(800); // 8.00%
    expect(result.bracketBreakdown).toHaveLength(1);
    expect(result.bracketBreakdown[0]?.bracketIndex).toBe(7); // bracket 8 (0-indexed)
  });

  it('enforces $0.50 minimum TF (GMV $0, sale $1)', () => {
    // 10% of $1 = $0.10, but minimum is $0.50
    const result = calculateTf(0, 100); // $1 sale
    expect(result.tfCents).toBe(50); // $0.50 minimum
    expect(result.effectiveRateBps).toBe(5000); // Effective rate is 50% due to minimum
  });

  it('returns zero for zero sale price', () => {
    const result = calculateTf(50000, 0);
    expect(result.tfCents).toBe(0);
    expect(result.effectiveRateBps).toBe(0);
    expect(result.bracketBreakdown).toHaveLength(0);
  });

  it('returns zero for negative sale price', () => {
    const result = calculateTf(50000, -100);
    expect(result.tfCents).toBe(0);
    expect(result.effectiveRateBps).toBe(0);
    expect(result.bracketBreakdown).toHaveLength(0);
  });

  it('calculates correct effective rate (TF / salePrice * 10000)', () => {
    // Simple case: 10% rate, $50 sale = $5 TF
    const result = calculateTf(0, 5000);
    expect(result.tfCents).toBe(500);
    expect(result.effectiveRateBps).toBe(1000); // 500 / 5000 * 10000 = 1000
  });

  it('handles sale spanning multiple brackets (GMV $0, sale $200,000)', () => {
    // Sale of $200,000 from GMV $0 spans all 8 brackets
    const result = calculateTf(0, 20000000);

    // Should span all 8 brackets
    expect(result.bracketBreakdown.length).toBe(8);

    // Verify each bracket is hit in order
    for (let i = 0; i < 8; i++) {
      expect(result.bracketBreakdown[i]?.bracketIndex).toBe(i);
    }

    // Calculate expected TF manually:
    // B1: $499 at 10% = $49.90
    // B2: $1,500 at 11% = $165
    // B3: $3,000 at 10.5% = $315
    // B4: $5,000 at 10% = $500
    // B5: $15,000 at 9.5% = $1,425
    // B6: $25,000 at 9% = $2,250
    // B7: $50,000 at 8.5% = $4,250
    // B8: $100,001 at 8% = $8,000.08
    // Total ~$16,954.98
    // With rounding, roughly 16955 cents
    expect(result.tfCents).toBeGreaterThan(1600000); // Should be ~$16,955
    expect(result.tfCents).toBeLessThan(1700000);
  });

  it('accepts custom brackets parameter', () => {
    const customBrackets = [
      { maxCents: 100000, rateBps: 500 }, // 5% for first $1000
      { maxCents: null, rateBps: 300 },   // 3% after
    ];

    const result = calculateTf(0, 200000, customBrackets); // $2000 sale

    // First $1000 at 5% = $50
    // Next $1000 at 3% = $30
    // Total = $80 = 8000 cents
    expect(result.bracketBreakdown).toHaveLength(2);
    expect(result.tfCents).toBe(8000);
  });
});

describe('getEffectiveRate', () => {
  it('returns correct bracket rate for given GMV', () => {
    // Test bracket 5: $10,000-$24,999 at 9.5% (950 bps)
    expect(getEffectiveRate(1500000)).toBe(950); // $15,000 GMV
  });

  it('returns bracket 1 rate for GMV $0', () => {
    expect(getEffectiveRate(0)).toBe(1000); // 10%
  });

  it('returns bracket 8 rate for GMV $100,000', () => {
    expect(getEffectiveRate(10000000)).toBe(800); // 8%
  });
});

describe('Constants', () => {
  it('DEFAULT_TF_BRACKETS has 8 brackets', () => {
    expect(DEFAULT_TF_BRACKETS).toHaveLength(8);
  });

  it('DEFAULT_TF_BRACKETS has correct structure', () => {
    // Bracket 1: $0-$499 at 10%
    expect(DEFAULT_TF_BRACKETS[0]?.maxCents).toBe(49900);
    expect(DEFAULT_TF_BRACKETS[0]?.rateBps).toBe(1000);

    // Bracket 8: unlimited at 8%
    expect(DEFAULT_TF_BRACKETS[7]?.maxCents).toBe(null);
    expect(DEFAULT_TF_BRACKETS[7]?.rateBps).toBe(800);
  });
});
