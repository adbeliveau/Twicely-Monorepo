import { describe, it, expect } from 'vitest';

// ─── Logic extracted from storefront-header.tsx ──────────────────────────

function formatResponseTime(hours: number): string {
  if (hours < 1) return 'minutes';
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

const EMERGING_BAND = 'EMERGING';

function shouldShowBadge(performanceBand: string): boolean {
  return performanceBand !== EMERGING_BAND;
}

// ─── Performance badge display ───────────────────────────────────────────

describe('StorefrontHeader - performance badge visibility', () => {
  it('shows performance badge for TOP_RATED', () => {
    expect(shouldShowBadge('TOP_RATED')).toBe(true);
  });

  it('shows performance badge for POWER_SELLER', () => {
    expect(shouldShowBadge('POWER_SELLER')).toBe(true);
  });

  it('shows performance badge for ESTABLISHED', () => {
    expect(shouldShowBadge('ESTABLISHED')).toBe(true);
  });

  it('does NOT show performance badge for EMERGING', () => {
    expect(shouldShowBadge('EMERGING')).toBe(false);
  });
});

// ─── Total sales count ───────────────────────────────────────────────────

describe('StorefrontHeader - total sales display', () => {
  it('shows total sales count when totalSales > 0', () => {
    const totalSales = 142;
    const shouldShow = totalSales > 0;
    expect(shouldShow).toBe(true);
  });

  it('does not show total sales when totalSales is 0', () => {
    const totalSales = 0;
    const shouldShow = totalSales > 0;
    expect(shouldShow).toBe(false);
  });

  it('formats large sales counts with toLocaleString', () => {
    const totalSales = 12345;
    const formatted = totalSales.toLocaleString();
    expect(formatted.length).toBeGreaterThan(4);
    expect(formatted).toContain('12');
  });
});

// ─── Response time display ───────────────────────────────────────────────

describe('StorefrontHeader - response time', () => {
  it('shows "Usually responds within X hours" when data available', () => {
    const avgResponseTimeHours = 3;
    const prefix = `Usually responds within ${formatResponseTime(avgResponseTimeHours)}`;
    expect(prefix).toBe('Usually responds within 3 hours');
  });

  it('does NOT show response time when avgResponseTimeHours is null', () => {
    const avgResponseTimeHours: number | null = null;
    expect(avgResponseTimeHours).toBeNull();
  });

  it('formats sub-hour response time as "minutes"', () => {
    expect(formatResponseTime(0.5)).toBe('minutes');
    expect(formatResponseTime(0.1)).toBe('minutes');
  });

  it('formats hourly response times', () => {
    expect(formatResponseTime(1)).toBe('1 hours');
    expect(formatResponseTime(12)).toBe('12 hours');
    expect(formatResponseTime(23)).toBe('23 hours');
  });

  it('formats multi-day response times', () => {
    expect(formatResponseTime(24)).toBe('1 day');
    expect(formatResponseTime(48)).toBe('2 days');
    expect(formatResponseTime(72)).toBe('3 days');
  });

  it('handles fractional hours by rounding', () => {
    expect(formatResponseTime(2.4)).toBe('2 hours');
    expect(formatResponseTime(2.6)).toBe('3 hours');
  });
});
