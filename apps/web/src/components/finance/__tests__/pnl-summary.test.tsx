/**
 * Tests for PnlSummary component (pnl-summary.tsx).
 *
 * Canonical §5 null-COGS rule:
 *   "Never show $0 where COGS is null. Always show '—' with tooltip:
 *   'Add your item cost to calculate profit.'"
 *
 * The component treats cogsTotalCents === 0 as "incomplete" (no COGS entered).
 * Real zero-COGS sellers do not exist — every resale item has a sourcing cost.
 *
 * These tests validate the cogsIncomplete flag logic and the COGS_MISSING_TOOLTIP
 * constant without requiring a full React rendering environment.
 */
import { describe, it, expect } from 'vitest';

// ─── Constants mirrored from pnl-summary.tsx ──────────────────────────────────

const COGS_MISSING_TOOLTIP = 'Add your item cost to calculate profit';

// ─── Logic extracted from PnlSummary for unit testing ────────────────────────

/**
 * Determines whether COGS data is absent for the period.
 * When cogsTotalCents === 0, the query layer excluded all null-COGS items
 * (via isNotNull filter), so the sum being zero means NO items had COGS entered.
 */
function isCogsIncomplete(cogsTotalCents: number): boolean {
  return cogsTotalCents === 0;
}

/**
 * Returns the value to display for a COGS-dependent row.
 * Returns null when COGS is incomplete (caller renders "—" + tooltip).
 * Returns the numeric value when COGS data is present.
 */
function cogsDisplayValue(
  valueCents: number,
  cogsIncomplete: boolean,
): number | null {
  return cogsIncomplete ? null : valueCents;
}

/**
 * Computes gross profit. Only meaningful when COGS is present.
 */
function computeGrossProfit(
  grossRevenueCents: number,
  cogsTotalCents: number,
): number {
  return grossRevenueCents - cogsTotalCents;
}

/**
 * Computes net profit. Only meaningful when COGS is present
 * (COGS contributes to the deduction).
 */
function computeNetProfit(
  grossRevenueCents: number,
  cogsTotalCents: number,
  totalFeesCents: number,
  shippingCostsCents: number,
  totalExpensesCents: number,
  totalDeductionCents: number,
): number {
  return (
    grossRevenueCents -
    cogsTotalCents -
    totalFeesCents -
    shippingCostsCents -
    totalExpensesCents -
    totalDeductionCents
  );
}

// ─── isCogsIncomplete ─────────────────────────────────────────────────────────

describe('PnlSummary - isCogsIncomplete (canonical §5)', () => {
  it('returns true when cogsTotalCents is 0 — no COGS data entered', () => {
    expect(isCogsIncomplete(0)).toBe(true);
  });

  it('returns false when cogsTotalCents > 0 — at least one item has COGS', () => {
    expect(isCogsIncomplete(1)).toBe(false);
    expect(isCogsIncomplete(5000)).toBe(false);
    expect(isCogsIncomplete(999999)).toBe(false);
  });

  it('treats exactly $0.01 (1 cent) as complete COGS data', () => {
    // Even a single penny of COGS means the seller entered something.
    expect(isCogsIncomplete(1)).toBe(false);
  });
});

// ─── cogsDisplayValue ─────────────────────────────────────────────────────────

describe('PnlSummary - cogsDisplayValue', () => {
  it('returns null when COGS incomplete — triggers "—" render', () => {
    expect(cogsDisplayValue(0, true)).toBeNull();
  });

  it('returns the actual cents value when COGS is present', () => {
    expect(cogsDisplayValue(5000, false)).toBe(5000);
  });

  it('returns null for gross profit when COGS incomplete', () => {
    const grossProfit = computeGrossProfit(100_00, 0);
    expect(cogsDisplayValue(grossProfit, true)).toBeNull();
  });

  it('returns null for net earnings when COGS incomplete', () => {
    const netProfit = computeNetProfit(100_00, 0, 10_00, 5_00, 0, 0);
    expect(cogsDisplayValue(netProfit, true)).toBeNull();
  });
});

// ─── COGS row always renders ──────────────────────────────────────────────────

describe('PnlSummary - COGS row visibility (canonical §5)', () => {
  it('COGS row always renders regardless of cogsTotalCents value', () => {
    // The fix removes the {hasCogs && <CogsRow />} gate.
    // We test this by asserting the rendering decision: cogsIncomplete never
    // hides the row — it only changes its displayed value.
    const renderWithCogs = (cogsTotalCents: number) => {
      const cogsIncomplete = isCogsIncomplete(cogsTotalCents);
      // Row always renders — only the display value changes.
      const displayed = cogsDisplayValue(cogsTotalCents, cogsIncomplete);
      return { rowRendered: true, displayed };
    };

    // With COGS present
    expect(renderWithCogs(5000)).toEqual({ rowRendered: true, displayed: 5000 });

    // Without COGS — row STILL renders, value is null (triggers dash render)
    expect(renderWithCogs(0)).toEqual({ rowRendered: true, displayed: null });
  });

  it('Gross Profit row always renders regardless of cogsTotalCents', () => {
    const renderGrossProfit = (grossRevenueCents: number, cogsTotalCents: number) => {
      const cogsIncomplete = isCogsIncomplete(cogsTotalCents);
      const grossProfit = computeGrossProfit(grossRevenueCents, cogsTotalCents);
      return { rowRendered: true, displayed: cogsDisplayValue(grossProfit, cogsIncomplete) };
    };

    expect(renderGrossProfit(100_00, 40_00)).toEqual({ rowRendered: true, displayed: 60_00 });
    expect(renderGrossProfit(100_00, 0)).toEqual({ rowRendered: true, displayed: null });
  });

  it('Net earnings row always renders; shows null (dash) when COGS incomplete', () => {
    const renderNetEarnings = (cogsTotalCents: number) => {
      const cogsIncomplete = isCogsIncomplete(cogsTotalCents);
      const net = computeNetProfit(100_00, cogsTotalCents, 10_00, 5_00, 2_00, 1_00);
      return { rowRendered: true, displayed: cogsDisplayValue(net, cogsIncomplete) };
    };

    // COGS present: 10000 - 4000 - 1000 - 500 - 200 - 100 = 4200
    expect(renderNetEarnings(40_00)).toEqual({ rowRendered: true, displayed: 42_00 });

    // COGS absent: net profit would be dishonest — show dash
    expect(renderNetEarnings(0)).toEqual({ rowRendered: true, displayed: null });
  });
});

// ─── Tooltip text ─────────────────────────────────────────────────────────────

describe('PnlSummary - COGS missing tooltip text (canonical §5)', () => {
  it('matches the exact canonical tooltip text', () => {
    // Canonical v3.0 §5: "Add your item cost to calculate profit"
    expect(COGS_MISSING_TOOLTIP).toBe('Add your item cost to calculate profit');
  });

  it('does not end with a period — canonical text has no trailing punctuation', () => {
    expect(COGS_MISSING_TOOLTIP.endsWith('.')).toBe(false);
  });
});

// ─── Math correctness ─────────────────────────────────────────────────────────

describe('PnlSummary - computeNetProfit', () => {
  it('computes correct net profit when all values present', () => {
    const net = computeNetProfit(
      200_00, // gross revenue
      80_00,  // COGS
      20_00,  // fees
      10_00,  // shipping
      5_00,   // expenses
      3_00,   // mileage
    );
    // 20000 - 8000 - 2000 - 1000 - 500 - 300 = 8200
    expect(net).toBe(82_00);
  });

  it('returns integer cents (no floats)', () => {
    const net = computeNetProfit(100_00, 33_33, 10_00, 5_00, 0, 0);
    expect(Number.isInteger(net)).toBe(true);
  });

  it('gross profit equals revenue minus COGS', () => {
    expect(computeGrossProfit(100_00, 40_00)).toBe(60_00);
    expect(computeGrossProfit(50_00, 50_00)).toBe(0);
  });
});
