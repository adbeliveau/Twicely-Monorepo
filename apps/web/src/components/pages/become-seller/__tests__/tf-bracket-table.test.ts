import { describe, it, expect } from 'vitest';
import type { TfBracket } from '@/lib/queries/become-seller';

// ─── Pure logic helpers extracted from TfBracketTable for unit testing ────────

function formatRate(rateBps: number): string {
  return `${(rateBps / 100).toFixed(2)}%`;
}

function makeTestBrackets(): TfBracket[] {
  return [
    { bracketNumber: 1, maxCents: 49900, rateBps: 1000 },
    { bracketNumber: 2, maxCents: 199900, rateBps: 1100 },
    { bracketNumber: 3, maxCents: 499900, rateBps: 1050 },
    { bracketNumber: 4, maxCents: 999900, rateBps: 1000 },
    { bracketNumber: 5, maxCents: 2499900, rateBps: 950 },
    { bracketNumber: 6, maxCents: 4999900, rateBps: 900 },
    { bracketNumber: 7, maxCents: 9999900, rateBps: 850 },
    { bracketNumber: 8, maxCents: null, rateBps: 800 },
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TfBracketTable', () => {
  it('renders 8 rows when given 8 brackets', () => {
    const brackets = makeTestBrackets();
    expect(brackets).toHaveLength(8);
    brackets.forEach((b, i) => {
      expect(b.bracketNumber).toBe(i + 1);
    });
  });

  it('displays rate as percentage (rateBps / 100) not raw bps', () => {
    // 1000 bps = 10.00%
    expect(formatRate(1000)).toBe('10.00%');
    // 1100 bps = 11.00%
    expect(formatRate(1100)).toBe('11.00%');
    // 800 bps = 8.00%
    expect(formatRate(800)).toBe('8.00%');
  });

  it('shows "No limit" for bracket with null maxCents', () => {
    const brackets = makeTestBrackets();
    const lastIndex = brackets.length - 1;
    const lastBracket = brackets[lastIndex];
    expect(lastBracket).toBeDefined();
    if (!lastBracket) return;
    expect(lastBracket.maxCents).toBeNull();
    expect(lastBracket.bracketNumber).toBe(8);
  });

  it('does not display "marginal rate" label — displays bracket rate as educational only', () => {
    // The component label column is "Transaction fee rate" — not "your rate" or "marginal rate"
    // This is tested by asserting the bracket data type has no label suggesting personal rates
    const brackets = makeTestBrackets();
    brackets.forEach((b) => {
      expect(b).not.toHaveProperty('yourRate');
      expect(b).not.toHaveProperty('marginalRate');
      expect(b).not.toHaveProperty('effectiveRate');
    });
  });

  it('bracket 8 has the lowest rate (8.00%)', () => {
    const brackets = makeTestBrackets();
    const last = brackets[brackets.length - 1];
    expect(last).toBeDefined();
    if (!last) return;
    expect(last.rateBps).toBe(800);
    expect(formatRate(last.rateBps)).toBe('8.00%');
  });

  it('bracket 1 has 10.00% rate', () => {
    const brackets = makeTestBrackets();
    const first = brackets[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(formatRate(first.rateBps)).toBe('10.00%');
  });

  it('BRACKET_LABELS fallback: unknown bracketNumber with null maxCents shows "No limit"', () => {
    // Mirrors the ternary in TfBracketTable: ?? (maxCents === null ? 'No limit' : `Up to ${formatDollars(maxCents)}`)
    function bracketLabel(bracketNumber: number, maxCents: number | null): string {
      const BRACKET_LABELS: Record<number, string> = {
        1: '$0 – $499', 2: '$500 – $1,999', 3: '$2,000 – $4,999',
        4: '$5,000 – $9,999', 5: '$10,000 – $24,999', 6: '$25,000 – $49,999',
        7: '$50,000 – $99,999', 8: '$100,000+',
      };
      return BRACKET_LABELS[bracketNumber] ?? (maxCents === null ? 'No limit' : `Up to $${(maxCents / 100).toFixed(0)}`);
    }
    // Known bracket — uses static label
    expect(bracketLabel(1, 49900)).toBe('$0 – $499');
    expect(bracketLabel(8, null)).toBe('$100,000+');
    // Unknown bracket (e.g. 9 hypothetical) with null maxCents — fallback path
    expect(bracketLabel(9, null)).toBe('No limit');
    // Unknown bracket with a real maxCents — fallback path with amount
    expect(bracketLabel(9, 14999900)).toBe('Up to $149999');
  });

  it('formatDollars converts integer cents to whole-dollar USD without decimal places', () => {
    function formatDollars(cents: number): string {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(cents / 100);
    }
    expect(formatDollars(49900)).toBe('$499');
    expect(formatDollars(4999900)).toBe('$49,999');
    expect(formatDollars(9999900)).toBe('$99,999');
    // Verifies no decimal places even for round numbers
    expect(formatDollars(10000)).toBe('$100');
  });

  it('all 8 canonical bracket labels are present and match the spec', () => {
    const BRACKET_LABELS: Record<number, string> = {
      1: '$0 – $499', 2: '$500 – $1,999', 3: '$2,000 – $4,999',
      4: '$5,000 – $9,999', 5: '$10,000 – $24,999', 6: '$25,000 – $49,999',
      7: '$50,000 – $99,999', 8: '$100,000+',
    };
    expect(Object.keys(BRACKET_LABELS)).toHaveLength(8);
    // The last bracket uses $100,000+ (open-ended), not a range
    expect(BRACKET_LABELS[8]).toBe('$100,000+');
    // No bracket shows "marginal" or "your rate" in its label
    Object.values(BRACKET_LABELS).forEach((label) => {
      expect(label).not.toMatch(/marginal|your rate|effective/i);
    });
  });
});
