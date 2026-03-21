import { describe, it, expect } from 'vitest';
import {
  formatDate,
  statusLabel,
  isActive,
  isPastDue,
  isFreeOrNone,
} from '../subscription-card';
import type { AvailableTier, SubscriptionCardProps } from '../subscription-card';

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseTier: AvailableTier = {
  tier: 'PRO', label: 'Pro', monthlyPrice: '$39.99/mo', annualPrice: '$29.99/mo',
  annualSavings: 25, features: ['Feature A', 'Feature B'],
};

function baseProps(overrides: Partial<SubscriptionCardProps> = {}): SubscriptionCardProps {
  return {
    title: 'Store',
    product: 'store',
    currentTier: 'NONE',
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    availableTiers: [baseTier],
    onSubscribe: () => {},
    canSubscribe: true,
    isUpgradeAvailable: false,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S3: SubscriptionCard helpers', () => {
  // ── formatDate ──────────────────────────────────────────────────────────
  it('returns empty string for null date', () => {
    expect(formatDate(null)).toBe('');
  });

  it('formats a valid date in en-US short format', () => {
    const result = formatDate(new Date('2026-04-15'));
    expect(result).toContain('2026');
    expect(result).toContain('Apr');
  });

  // ── statusLabel ─────────────────────────────────────────────────────────
  it('returns "Active" for ACTIVE status', () => {
    expect(statusLabel('ACTIVE')).toBe('Active');
  });

  it('returns "Trialing" for TRIALING status', () => {
    expect(statusLabel('TRIALING')).toBe('Trialing');
  });

  it('returns "Past Due" for PAST_DUE status', () => {
    expect(statusLabel('PAST_DUE')).toBe('Past Due');
  });

  it('returns "Canceled" for CANCELED status', () => {
    expect(statusLabel('CANCELED')).toBe('Canceled');
  });

  it('returns "Inactive" for null status', () => {
    expect(statusLabel(null)).toBe('Inactive');
  });

  // ── isActive ────────────────────────────────────────────────────────────
  it('isActive returns true for ACTIVE and TRIALING', () => {
    expect(isActive('ACTIVE')).toBe(true);
    expect(isActive('TRIALING')).toBe(true);
    expect(isActive('PAST_DUE')).toBe(false);
    expect(isActive('CANCELED')).toBe(false);
    expect(isActive(null)).toBe(false);
  });

  // ── isPastDue ───────────────────────────────────────────────────────────
  it('isPastDue returns true only for PAST_DUE', () => {
    expect(isPastDue('PAST_DUE')).toBe(true);
    expect(isPastDue('ACTIVE')).toBe(false);
    expect(isPastDue(null)).toBe(false);
  });

  // ── isFreeOrNone ────────────────────────────────────────────────────────
  it('isFreeOrNone returns true for NONE and FREE', () => {
    expect(isFreeOrNone('NONE')).toBe(true);
    expect(isFreeOrNone('FREE')).toBe(true);
    expect(isFreeOrNone('PRO')).toBe(false);
    expect(isFreeOrNone('STARTER')).toBe(false);
  });

  // ── Props type validates correctly ──────────────────────────────────────
  it('baseProps produces valid SubscriptionCardProps', () => {
    const props = baseProps();
    expect(props.title).toBe('Store');
    expect(props.product).toBe('store');
    expect(props.currentTier).toBe('NONE');
    expect(props.canSubscribe).toBe(true);
    expect(props.availableTiers).toHaveLength(1);
    expect(props.availableTiers[0]?.tier).toBe('PRO');
  });

  it('baseProps with overrides merges correctly', () => {
    const props = baseProps({
      currentTier: 'PRO',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-04-15'),
    });
    expect(props.currentTier).toBe('PRO');
    expect(props.status).toBe('ACTIVE');
    expect(props.cancelAtPeriodEnd).toBe(true);
    expect(props.currentPeriodEnd).toEqual(new Date('2026-04-15'));
  });
});
