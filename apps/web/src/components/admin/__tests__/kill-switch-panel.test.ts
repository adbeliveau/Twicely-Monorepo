/**
 * Kill Switch Panel — Pure Logic Tests (G10.4)
 * Tests rendering decisions without DOM rendering.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

// ─── Pure logic extracted from KillSwitchPanel ────────────────────────────────

function filterKillSwitches(flags: FeatureFlagRow[]): FeatureFlagRow[] {
  return flags.filter((f) => f.key.startsWith('kill.'));
}

function getStatusLabel(enabled: boolean): string {
  return enabled ? 'ACTIVE' : 'KILLED';
}

function isEmptyState(flags: FeatureFlagRow[]): boolean {
  return flags.length === 0;
}

function getConfirmationMessage(flagName: string, currentEnabled: boolean): string {
  if (currentEnabled) {
    return `Disable ${flagName}? This will immediately prevent all users from accessing this feature.`;
  }
  return `Re-enable ${flagName}?`;
}

// ─── Test data ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-20T10:00:00Z');

function makeFlag(key: string, enabled: boolean): FeatureFlagRow {
  return {
    id: `flag-${key}`,
    key,
    name: key.replace('kill.', '').replace('.', ' '),
    description: `Disables ${key}`,
    type: 'BOOLEAN',
    enabled,
    percentage: null,
    targetingJson: {},
    createdByStaffId: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const KILL_FLAGS: FeatureFlagRow[] = [
  makeFlag('kill.checkout', true),
  makeFlag('kill.crosslister', true),
  makeFlag('kill.messaging', false),
];

const MIXED_FLAGS: FeatureFlagRow[] = [
  makeFlag('kill.checkout', true),
  makeFlag('gate.marketplace', false),
  { ...makeFlag('feature.newSearch', true), key: 'feature.newSearch' },
];

// ─── Filter tests ─────────────────────────────────────────────────────────────

describe('KillSwitchPanel — filter logic', () => {
  it('renders only kill.* flags', () => {
    const result = filterKillSwitches(MIXED_FLAGS);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('kill.checkout');
  });

  it('returns empty when no kill switches present', () => {
    const nonKillFlags = MIXED_FLAGS.filter((f) => !f.key.startsWith('kill.'));
    expect(filterKillSwitches(nonKillFlags)).toHaveLength(0);
  });

  it('returns all kill.* flags from a pure kill list', () => {
    expect(filterKillSwitches(KILL_FLAGS)).toHaveLength(3);
  });
});

// ─── Status badge tests ───────────────────────────────────────────────────────

describe('KillSwitchPanel — status badges', () => {
  it('shows ACTIVE badge when enabled', () => {
    expect(getStatusLabel(true)).toBe('ACTIVE');
  });

  it('shows KILLED badge when disabled', () => {
    expect(getStatusLabel(false)).toBe('KILLED');
  });
});

// ─── Empty state tests ────────────────────────────────────────────────────────

describe('KillSwitchPanel — empty state', () => {
  it('shows empty state when no flags', () => {
    expect(isEmptyState([])).toBe(true);
  });

  it('does not show empty state when flags present', () => {
    expect(isEmptyState(KILL_FLAGS)).toBe(false);
  });
});

// ─── Confirmation dialog tests ────────────────────────────────────────────────

describe('KillSwitchPanel — confirmation dialogs', () => {
  it('shows destructive confirmation when toggling OFF a kill switch', () => {
    const msg = getConfirmationMessage('Checkout', true);
    expect(msg).toContain('Disable Checkout');
    expect(msg).toContain('immediately prevent all users');
  });

  it('shows lighter confirmation when toggling ON a kill switch', () => {
    const msg = getConfirmationMessage('Checkout', false);
    expect(msg).toContain('Re-enable Checkout');
  });
});
