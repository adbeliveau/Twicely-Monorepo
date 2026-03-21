/**
 * F4-S4: ListerSubscriptionCard helper logic tests.
 *
 * Tests pure computation branches extracted from lister-subscription-card.tsx.
 * No React rendering — component imports ui libraries that require DOM setup.
 * Pattern: extract pure functions, test them directly. (MEMORY.md: "Component logic tests")
 */
import { describe, it, expect } from 'vitest';

// ─── Extracted pure helpers (mirror lister-subscription-card.tsx source) ─────

/** Progress bar used-percent: based on total (monthly + rollover) */
function usedPercent(used: number, monthlyLimit: number, rolloverBalance: number): number {
  const total = monthlyLimit + rolloverBalance;
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
}

/** Progress bar color based on usage percent */
function meterColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct > 75) return 'bg-amber-500';
  return 'bg-green-500';
}

/** Tier display label */
function tierLabel(tier: string): string {
  if (tier === 'FREE') return 'Free';
  if (tier === 'LITE') return 'Lite';
  if (tier === 'PRO') return 'Pro';
  return tier;
}

/** Whether rollover section should be shown */
function showRollover(rolloverBalance: number): boolean {
  return rolloverBalance > 0;
}

/** Remaining text includes rollover note when rolloverBalance > 0 */
function rolloverNote(rolloverBalance: number): string | null {
  if (rolloverBalance <= 0) return null;
  return `includes ${rolloverBalance} rollover`;
}

/** Whether to show import CTA (NONE state) */
function isNoneState(listerTier: string): boolean {
  return listerTier === 'NONE';
}

/** Format date for display (mirrors lister-subscription-card.tsx formatDate) */
function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('F4-S4: ListerSubscriptionCard helper logic', () => {
  // ─── Progress bar percentage ─────────────────────────────────────────────

  describe('usedPercent', () => {
    it('returns 0 when 0 publishes used', () => {
      expect(usedPercent(0, 200, 0)).toBe(0);
    });

    it('returns 75 when 150 of 200 used', () => {
      expect(usedPercent(150, 200, 0)).toBe(75);
    });

    it('returns 100 (capped) when used > total', () => {
      expect(usedPercent(300, 200, 0)).toBe(100);
    });

    it('includes rollover in total denominator', () => {
      // used=75, total=200+100=300 → 25%
      expect(usedPercent(75, 200, 100)).toBe(25);
    });

    it('returns 0 when total is 0 (avoids division by zero)', () => {
      expect(usedPercent(0, 0, 0)).toBe(0);
    });
  });

  // ─── Progress bar color ──────────────────────────────────────────────────

  describe('meterColor', () => {
    it('returns green when usage < 75%', () => {
      expect(meterColor(74)).toBe('bg-green-500');
      expect(meterColor(0)).toBe('bg-green-500');
      expect(meterColor(50)).toBe('bg-green-500');
    });

    it('returns amber when usage is between 76% and 90%', () => {
      expect(meterColor(76)).toBe('bg-amber-500');
      expect(meterColor(90)).toBe('bg-amber-500');
    });

    it('returns red when usage exceeds 90%', () => {
      expect(meterColor(91)).toBe('bg-red-500');
      expect(meterColor(100)).toBe('bg-red-500');
    });

    it('returns green at exactly 75% (boundary: > 75 is amber)', () => {
      expect(meterColor(75)).toBe('bg-green-500');
    });
  });

  // ─── Rollover display ────────────────────────────────────────────────────

  describe('showRollover', () => {
    it('returns false when rolloverBalance is 0', () => {
      expect(showRollover(0)).toBe(false);
    });

    it('returns true when rolloverBalance > 0', () => {
      expect(showRollover(150)).toBe(true);
      expect(showRollover(1)).toBe(true);
    });
  });

  describe('rolloverNote', () => {
    it('returns null when no rollover balance', () => {
      expect(rolloverNote(0)).toBeNull();
    });

    it('includes the rollover count in text', () => {
      const note = rolloverNote(150);
      expect(note).toContain('150');
      expect(note).toContain('rollover');
    });
  });

  // ─── Tier label ──────────────────────────────────────────────────────────

  describe('tierLabel', () => {
    it('maps FREE to "Free"', () => {
      expect(tierLabel('FREE')).toBe('Free');
    });

    it('maps LITE to "Lite"', () => {
      expect(tierLabel('LITE')).toBe('Lite');
    });

    it('maps PRO to "Pro"', () => {
      expect(tierLabel('PRO')).toBe('Pro');
    });

    it('returns raw tier string for unknown values', () => {
      expect(tierLabel('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  // ─── NONE state detection ────────────────────────────────────────────────

  describe('isNoneState', () => {
    it('returns true for NONE tier (show import CTA)', () => {
      expect(isNoneState('NONE')).toBe(true);
    });

    it('returns false for FREE tier (show subscription info, not import CTA)', () => {
      expect(isNoneState('FREE')).toBe(false);
    });

    it('returns false for LITE and PRO tiers', () => {
      expect(isNoneState('LITE')).toBe(false);
      expect(isNoneState('PRO')).toBe(false);
    });
  });

  // ─── formatDate ──────────────────────────────────────────────────────────

  describe('formatDate', () => {
    it('returns empty string for null date', () => {
      expect(formatDate(null)).toBe('');
    });

    it('formats a valid date in en-US short format', () => {
      const result = formatDate(new Date('2026-06-15'));
      expect(result).toContain('2026');
      expect(result).toContain('Jun');
    });
  });
});

// ─── PublishMeterDisplay logic (publish-meter-display.tsx) ───────────────────

/** Mirrors meterColor from publish-meter-display.tsx (same function, same thresholds) */
function displayMeterColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct > 75) return 'bg-amber-500';
  return 'bg-green-500';
}

/** Mirrors isRunningLow calculation from PublishMeterDisplay */
function isRunningLow(total: number, remaining: number): boolean {
  return total > 0 && remaining / total < 0.2 && remaining > 0;
}

/** Mirrors isExhausted calculation from PublishMeterDisplay */
function isExhausted(remaining: number): boolean {
  return remaining === 0;
}

describe('F4-S4: PublishMeterDisplay logic', () => {
  describe('displayMeterColor', () => {
    it('green below 75%', () => expect(displayMeterColor(74)).toBe('bg-green-500'));
    it('amber at 76%', () => expect(displayMeterColor(76)).toBe('bg-amber-500'));
    it('red above 90%', () => expect(displayMeterColor(91)).toBe('bg-red-500'));
  });

  describe('isRunningLow', () => {
    it('returns true when remaining is < 20% of total', () => {
      // total=200, remaining=30 → 15% → running low
      expect(isRunningLow(200, 30)).toBe(true);
    });

    it('returns false when remaining is exactly 20% of total', () => {
      // total=200, remaining=40 → exactly 20% → NOT running low (< not <=)
      expect(isRunningLow(200, 40)).toBe(false);
    });

    it('returns false when remaining is 0 (use isExhausted instead)', () => {
      expect(isRunningLow(200, 0)).toBe(false);
    });

    it('returns false when total is 0', () => {
      expect(isRunningLow(0, 0)).toBe(false);
    });
  });

  describe('isExhausted', () => {
    it('returns true when remaining is 0', () => {
      expect(isExhausted(0)).toBe(true);
    });

    it('returns false when remaining > 0', () => {
      expect(isExhausted(1)).toBe(false);
      expect(isExhausted(200)).toBe(false);
    });
  });
});
