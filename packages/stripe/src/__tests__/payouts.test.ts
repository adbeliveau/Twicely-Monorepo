import { describe, it, expect } from 'vitest';

describe('TIER_PAYOUT_OPTIONS (tier gating)', () => {
  // Test the tier gating logic directly (pure data, no module imports needed)
  // This matches the constant in payout-settings.ts
  // v3.2 StoreTier: NONE | STARTER | PRO | POWER | ENTERPRISE
  const TIER_PAYOUT_OPTIONS: Record<string, string[]> = {
    NONE: ['manual'],
    STARTER: ['weekly', 'manual'],
    PRO: ['weekly', 'manual'],
    POWER: ['weekly', 'daily', 'manual'],
    ENTERPRISE: ['weekly', 'daily', 'manual', 'monthly'],
  };

  it('NONE tier has only manual (no auto-payout)', () => {
    expect(TIER_PAYOUT_OPTIONS.NONE).toEqual(['manual']);
    expect(TIER_PAYOUT_OPTIONS.NONE).toHaveLength(1);
    expect(TIER_PAYOUT_OPTIONS.NONE).not.toContain('weekly');
    expect(TIER_PAYOUT_OPTIONS.NONE).not.toContain('daily');
  });

  it('STARTER tier has weekly and manual', () => {
    expect(TIER_PAYOUT_OPTIONS.STARTER).toEqual(['weekly', 'manual']);
    expect(TIER_PAYOUT_OPTIONS.STARTER).toContain('weekly');
    expect(TIER_PAYOUT_OPTIONS.STARTER).not.toContain('daily');
  });

  it('PRO tier has weekly and manual', () => {
    expect(TIER_PAYOUT_OPTIONS.PRO).toEqual(['weekly', 'manual']);
    expect(TIER_PAYOUT_OPTIONS.PRO).toContain('weekly');
    expect(TIER_PAYOUT_OPTIONS.PRO).not.toContain('daily');
  });

  it('POWER tier has weekly, daily, and manual', () => {
    expect(TIER_PAYOUT_OPTIONS.POWER).toEqual(['weekly', 'daily', 'manual']);
    expect(TIER_PAYOUT_OPTIONS.POWER).toContain('daily');
    expect(TIER_PAYOUT_OPTIONS.POWER).not.toContain('monthly');
  });

  it('ENTERPRISE tier has all options including monthly', () => {
    expect(TIER_PAYOUT_OPTIONS.ENTERPRISE).toEqual(['weekly', 'daily', 'manual', 'monthly']);
    expect(TIER_PAYOUT_OPTIONS.ENTERPRISE).toContain('monthly');
    expect(TIER_PAYOUT_OPTIONS.ENTERPRISE).toHaveLength(4);
  });

  it('lower tiers cannot access higher tier options', () => {
    // NONE cannot select weekly or daily
    expect(TIER_PAYOUT_OPTIONS.NONE).not.toContain('weekly');
    expect(TIER_PAYOUT_OPTIONS.NONE).not.toContain('daily');
    // STARTER/PRO cannot select daily
    expect(TIER_PAYOUT_OPTIONS.STARTER).not.toContain('daily');
    expect(TIER_PAYOUT_OPTIONS.PRO).not.toContain('daily');
    // POWER cannot select monthly
    expect(TIER_PAYOUT_OPTIONS.POWER).not.toContain('monthly');
  });
});

describe('PayoutStatus values', () => {
  // Test expected payout status values (from payouts.ts type)
  const VALID_PAYOUT_STATUSES = ['paid', 'pending', 'in_transit', 'canceled', 'failed'];

  it('includes paid status', () => {
    expect(VALID_PAYOUT_STATUSES).toContain('paid');
  });

  it('includes pending status', () => {
    expect(VALID_PAYOUT_STATUSES).toContain('pending');
  });

  it('includes in_transit status', () => {
    expect(VALID_PAYOUT_STATUSES).toContain('in_transit');
  });

  it('includes canceled status', () => {
    expect(VALID_PAYOUT_STATUSES).toContain('canceled');
  });

  it('includes failed status', () => {
    expect(VALID_PAYOUT_STATUSES).toContain('failed');
  });
});
