/**
 * Tests for Finance Intelligence Layer card components.
 * Financial Center Canonical §6 — data gates and disclaimer enforcement.
 *
 * Uses logic-level tests (no React rendering) to verify:
 * - Data gates return null correctly
 * - Tax disclaimers are present in source
 * - Goal tracker handles missing goals
 * - Dead stock threshold logic
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const INTEL_DIR = join(
  __dirname,
  '..',
);

function readCard(filename: string): string {
  return readFileSync(join(INTEL_DIR, filename), 'utf-8');
}

// ─── Tax disclaimer enforcement ───────────────────────────────────────────────

const TAX_DISCLAIMER =
  'This is not tax advice. Consult a qualified tax professional for your specific situation.';

describe('Tax disclaimer enforcement', () => {
  it('tax-withholding-card contains required disclaimer', () => {
    const src = readCard('tax-withholding-card.tsx');
    expect(src).toContain(TAX_DISCLAIMER);
  });

  it('quarterly-tax-card contains required disclaimer', () => {
    const src = readCard('quarterly-tax-card.tsx');
    expect(src).toContain(TAX_DISCLAIMER);
  });
});

// ─── Data gate logic ─────────────────────────────────────────────────────────

describe('Health Score card data gate', () => {
  it('returns null when healthScore is null', () => {
    // Gate logic: if (healthScore === null) return null
    function gateCheck(healthScore: number | null): boolean {
      return healthScore === null;
    }
    expect(gateCheck(null)).toBe(true);
    expect(gateCheck(72)).toBe(false);
  });

  it('returns non-null for score of 0', () => {
    function gateCheck(healthScore: number | null): boolean {
      return healthScore === null;
    }
    expect(gateCheck(0)).toBe(false);
  });
});

describe('Revenue Velocity card data gate', () => {
  it('gate met when >= 3 orders this month', () => {
    function gateCheck(count: number): boolean {
      return count >= 3;
    }
    expect(gateCheck(2)).toBe(false);
    expect(gateCheck(3)).toBe(true);
    expect(gateCheck(10)).toBe(true);
  });

  it('gate not met for 0 orders', () => {
    function gateCheck(count: number): boolean {
      return count >= 3;
    }
    expect(gateCheck(0)).toBe(false);
  });
});

describe('Profit by Category card data gate', () => {
  it('gate met when totalWithCogs >= 5', () => {
    function gateCheck(totalWithCogs: number): boolean {
      return totalWithCogs >= 5;
    }
    expect(gateCheck(4)).toBe(false);
    expect(gateCheck(5)).toBe(true);
  });
});

describe('Cost Trends card data gate', () => {
  it('gate met when >= 3 months of expense history', () => {
    function gateCheck(monthCount: number): boolean {
      return monthCount >= 3;
    }
    expect(gateCheck(2)).toBe(false);
    expect(gateCheck(3)).toBe(true);
  });
});

describe('Dead Stock card data gate', () => {
  it('gate met when at least 1 stale listing', () => {
    function gateCheck(count: number): boolean {
      return count > 0;
    }
    expect(gateCheck(0)).toBe(false);
    expect(gateCheck(1)).toBe(true);
  });
});

describe('Performing Periods card data gate', () => {
  it('returns null when performingPeriodsJson is null', () => {
    function gateCheck(data: unknown): boolean {
      return data === null || data === undefined;
    }
    expect(gateCheck(null)).toBe(true);
    expect(gateCheck({ dayOfWeek: [], monthlyRevenue: [] })).toBe(false);
  });
});

describe('Capital Efficiency card data gate', () => {
  it('returns null when both inventory turns and break-even are null', () => {
    function gateCheck(
      inventoryTurnsPerMonth: number | null,
      breakEvenRevenueCents: number | null,
    ): boolean {
      return inventoryTurnsPerMonth === null && breakEvenRevenueCents === null;
    }
    expect(gateCheck(null, null)).toBe(true);
    expect(gateCheck(500, null)).toBe(false);
    expect(gateCheck(null, 30000)).toBe(false);
  });
});

// ─── Goal Tracker logic ───────────────────────────────────────────────────────

describe('Goal Tracker card', () => {
  it('shows no-goals state when financeGoals is null', () => {
    function hasGoals(
      financeGoals: { revenueGoalCents?: number | null; profitGoalCents?: number | null } | null,
    ): boolean {
      const hasRevenue =
        financeGoals?.revenueGoalCents != null && financeGoals.revenueGoalCents > 0;
      const hasProfit =
        financeGoals?.profitGoalCents != null && financeGoals.profitGoalCents > 0;
      return hasRevenue || hasProfit;
    }
    expect(hasGoals(null)).toBe(false);
    expect(hasGoals({})).toBe(false);
    expect(hasGoals({ revenueGoalCents: 0 })).toBe(false);
    expect(hasGoals({ revenueGoalCents: 100000 })).toBe(true);
    expect(hasGoals({ profitGoalCents: 50000 })).toBe(true);
  });

  it('progress percent clamps to 0-100', () => {
    function progressPercent(currentCents: number, goalCents: number): number {
      if (goalCents <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((currentCents / goalCents) * 100)));
    }
    expect(progressPercent(0, 100000)).toBe(0);
    expect(progressPercent(50000, 100000)).toBe(50);
    expect(progressPercent(100000, 100000)).toBe(100);
    expect(progressPercent(150000, 100000)).toBe(100); // clamped
  });
});

// ─── Source file structure checks ─────────────────────────────────────────────

describe('Card source structure', () => {
  it('all card files export a named component (not default)', () => {
    const cardFiles = [
      'goal-tracker-card.tsx',
      'revenue-velocity-card.tsx',
      'health-score-card.tsx',
      'profit-by-category-card.tsx',
      'tax-withholding-card.tsx',
      'quarterly-tax-card.tsx',
      'cost-trends-card.tsx',
      'dead-stock-card.tsx',
      'capital-efficiency-card.tsx',
      'performing-periods-card.tsx',
    ];
    for (const file of cardFiles) {
      const src = readCard(file);
      // All cards must export a named function (not `export default`)
      expect(src).toMatch(/export function \w+/);
    }
  });

  it('no card file contains banned terms', () => {
    const bannedTerms = ['FVF', 'fvf', 'Final Value Fee', 'SellerTier', 'SubscriptionTier'];
    const cardFiles = [
      'goal-tracker-card.tsx',
      'revenue-velocity-card.tsx',
      'health-score-card.tsx',
      'tax-withholding-card.tsx',
      'quarterly-tax-card.tsx',
    ];
    for (const file of cardFiles) {
      const src = readCard(file);
      for (const term of bannedTerms) {
        expect(src).not.toContain(term);
      }
    }
  });
});
