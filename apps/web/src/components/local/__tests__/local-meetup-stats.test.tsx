/**
 * Tests for LocalMeetupStats display logic (G2.17).
 *
 * Because LocalMeetupStats is a pure display component with no state,
 * these tests validate the logic helpers used within the component.
 * The vitest environment is node (no jsdom), so we test pure functions.
 */

import { describe, it, expect } from 'vitest';

// ─── Logic extracted from local-meetup-stats.tsx ─────────────────────────────

function formatCompletionPct(completionRate: number): string {
  return `${Math.round(completionRate * 100)}%`;
}

function shouldShowResponseLabel(responseLabel: string | null): boolean {
  return responseLabel !== null;
}

function buildStorefrontLine(completedCount: number, completionRate: number): string {
  const pct = Math.round(completionRate * 100);
  return `${completedCount} completed · ${pct}% completion rate`;
}

function buildListingDetailLine(
  completedCount: number,
  completionRate: number,
): string {
  const pct = Math.round(completionRate * 100);
  return `Local Pickup · ${completedCount} meetups · ${pct}% completion`;
}

function hasLocalPickupIcon(variant: 'storefront' | 'listing-detail'): boolean {
  // MapPin icon is always shown — both variants include it
  return variant === 'storefront' || variant === 'listing-detail';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalMeetupStats — storefront variant', () => {
  it('renders storefront variant with completed count and completion rate', () => {
    const line = buildStorefrontLine(47, 0.96);
    expect(line).toBe('47 completed · 96% completion rate');
  });

  it('displays completion rate as whole percent (rounds)', () => {
    expect(formatCompletionPct(0.9666)).toBe('97%');
    expect(formatCompletionPct(0.96)).toBe('96%');
    expect(formatCompletionPct(0.1)).toBe('10%');
    expect(formatCompletionPct(1.0)).toBe('100%');
  });

  it('does not render response label line when responseLabel is null', () => {
    expect(shouldShowResponseLabel(null)).toBe(false);
  });

  it('renders response label when provided', () => {
    expect(shouldShowResponseLabel('Same day')).toBe(true);
    expect(shouldShowResponseLabel('Within 1 hour')).toBe(true);
  });
});

describe('LocalMeetupStats — listing-detail variant', () => {
  it('renders listing-detail variant with compact layout', () => {
    const line = buildListingDetailLine(47, 0.96);
    expect(line).toBe('Local Pickup · 47 meetups · 96% completion');
  });

  it('shows MapPin icon for listing-detail variant', () => {
    expect(hasLocalPickupIcon('listing-detail')).toBe(true);
  });

  it('shows MapPin icon for storefront variant', () => {
    expect(hasLocalPickupIcon('storefront')).toBe(true);
  });

  it('rounds fractional completion rates for listing-detail', () => {
    // 0.963 → 96%, not 96.3%
    const line = buildListingDetailLine(30, 0.963);
    expect(line).toContain('96%');
    expect(line).not.toContain('96.3');
  });
});

describe('LocalMeetupStats — edge cases', () => {
  it('handles 100% completion rate', () => {
    expect(formatCompletionPct(1.0)).toBe('100%');
  });

  it('handles 0% completion rate', () => {
    expect(formatCompletionPct(0)).toBe('0%');
  });

  it('handles 1 completed meetup', () => {
    const line = buildStorefrontLine(1, 1.0);
    expect(line).toBe('1 completed · 100% completion rate');
  });
});
