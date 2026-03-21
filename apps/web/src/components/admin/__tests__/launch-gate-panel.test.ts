/**
 * Launch Gate Panel — Pure Logic Tests (G10.4)
 * Tests rendering decisions without DOM rendering.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

// ─── Pure logic extracted from LaunchGatePanel ────────────────────────────────

function filterLaunchGates(flags: FeatureFlagRow[]): FeatureFlagRow[] {
  return flags.filter((f) => f.key.startsWith('gate.'));
}

function getStatusLabel(enabled: boolean): string {
  return enabled ? 'OPEN' : 'CLOSED';
}

function getGateSummary(flags: FeatureFlagRow[]): string {
  const open = flags.filter((f) => f.enabled).length;
  return `${open} of ${flags.length} gates open`;
}

function isEmptyState(flags: FeatureFlagRow[]): boolean {
  return flags.length === 0;
}

// ─── Test data ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-20T10:00:00Z');

function makeFlag(key: string, enabled: boolean): FeatureFlagRow {
  return {
    id: `flag-${key}`,
    key,
    name: key.replace('gate.', '').replace('.', ' '),
    description: `Gate for ${key}`,
    type: 'BOOLEAN',
    enabled,
    percentage: null,
    targetingJson: {},
    createdByStaffId: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const GATE_FLAGS: FeatureFlagRow[] = [
  makeFlag('gate.marketplace', false),
  makeFlag('gate.crosslister', false),
  makeFlag('gate.local', true),
  makeFlag('gate.helpdesk', false),
];

const MIXED_FLAGS: FeatureFlagRow[] = [
  makeFlag('gate.marketplace', false),
  makeFlag('kill.checkout', true),
  { ...makeFlag('feature.newSearch', true), key: 'feature.newSearch' },
];

// ─── Filter tests ─────────────────────────────────────────────────────────────

describe('LaunchGatePanel — filter logic', () => {
  it('renders only gate.* flags', () => {
    const result = filterLaunchGates(MIXED_FLAGS);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('gate.marketplace');
  });

  it('returns all gate.* flags from a pure gate list', () => {
    expect(filterLaunchGates(GATE_FLAGS)).toHaveLength(4);
  });

  it('returns empty when no gate flags present', () => {
    const nonGate = MIXED_FLAGS.filter((f) => !f.key.startsWith('gate.'));
    expect(filterLaunchGates(nonGate)).toHaveLength(0);
  });
});

// ─── Status badge tests ───────────────────────────────────────────────────────

describe('LaunchGatePanel — status badges', () => {
  it('shows OPEN badge when enabled', () => {
    expect(getStatusLabel(true)).toBe('OPEN');
  });

  it('shows CLOSED badge when disabled', () => {
    expect(getStatusLabel(false)).toBe('CLOSED');
  });
});

// ─── Summary line tests ───────────────────────────────────────────────────────

describe('LaunchGatePanel — gate summary', () => {
  it('shows correct summary when one gate is open', () => {
    expect(getGateSummary(GATE_FLAGS)).toBe('1 of 4 gates open');
  });

  it('shows 0 of N when all gates are closed', () => {
    const allClosed = GATE_FLAGS.map((f) => ({ ...f, enabled: false }));
    expect(getGateSummary(allClosed)).toBe('0 of 4 gates open');
  });

  it('shows N of N when all gates are open', () => {
    const allOpen = GATE_FLAGS.map((f) => ({ ...f, enabled: true }));
    expect(getGateSummary(allOpen)).toBe('4 of 4 gates open');
  });
});

// ─── Empty state tests ────────────────────────────────────────────────────────

describe('LaunchGatePanel — empty state', () => {
  it('shows empty state when no gate flags', () => {
    expect(isEmptyState([])).toBe(true);
  });

  it('does not show empty state when gates present', () => {
    expect(isEmptyState(GATE_FLAGS)).toBe(false);
  });
});
