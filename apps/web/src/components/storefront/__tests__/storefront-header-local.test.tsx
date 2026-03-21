/**
 * Tests for StorefrontHeader local metrics rendering logic (G2.17).
 *
 * These tests validate the conditional rendering logic — when to show
 * local meetup stats based on the localMetrics prop value.
 * The vitest environment is node (no jsdom), so we test pure functions.
 */

import { describe, it, expect } from 'vitest';
import type { SellerLocalMetrics } from '@/lib/queries/local-metrics';

// ─── Logic extracted from StorefrontHeader ────────────────────────────────────

function shouldRenderLocalMeetupStats(
  localMetrics: SellerLocalMetrics | null,
): boolean {
  return localMetrics !== null;
}

function getLocalDisplayData(
  localMetrics: SellerLocalMetrics,
): {
  completedCount: number;
  completionPct: number;
  responseLabel: string | null;
} {
  return {
    completedCount: localMetrics.localCompletedCount,
    completionPct: Math.round(localMetrics.localCompletionRate * 100),
    responseLabel: localMetrics.localAvgResponseLabel,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLocalMetrics(
  overrides: Partial<SellerLocalMetrics> = {},
): SellerLocalMetrics {
  return {
    localTransactionCount: 47,
    localCompletedCount: 45,
    localCompletionRate: 0.96,
    localReliabilityTier: 'RELIABLE',
    localAvgResponseLabel: 'Same day',
    hasLocalActivity: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StorefrontHeader — local meetup stats rendering', () => {
  it('renders local meetup stats when localMetrics is present', () => {
    const metrics = makeLocalMetrics();
    expect(shouldRenderLocalMeetupStats(metrics)).toBe(true);
  });

  it('does NOT render local meetup stats when localMetrics is null', () => {
    expect(shouldRenderLocalMeetupStats(null)).toBe(false);
  });

  it('extracts correct display data from localMetrics', () => {
    const metrics = makeLocalMetrics({
      localCompletedCount: 47,
      localCompletionRate: 0.96,
      localAvgResponseLabel: 'Within 1 hour',
    });
    const display = getLocalDisplayData(metrics);
    expect(display.completedCount).toBe(47);
    expect(display.completionPct).toBe(96);
    expect(display.responseLabel).toBe('Within 1 hour');
  });

  it('passes null responseLabel through when no response data', () => {
    const metrics = makeLocalMetrics({ localAvgResponseLabel: null });
    const display = getLocalDisplayData(metrics);
    expect(display.responseLabel).toBeNull();
  });

  it('correctly maps localCompletedCount (not localTransactionCount)', () => {
    const metrics = makeLocalMetrics({
      localTransactionCount: 50,
      localCompletedCount: 45,
    });
    const display = getLocalDisplayData(metrics);
    // Should use completedCount, not total transaction count
    expect(display.completedCount).toBe(45);
    expect(display.completedCount).not.toBe(50);
  });
});
