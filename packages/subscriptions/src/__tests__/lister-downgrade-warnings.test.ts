import { describe, it, expect, vi } from 'vitest';

/**
 * F4-S2: Lister Downgrade Warnings
 *
 * getListerDowngradeWarnings is a pure function — no mocks needed for the core logic.
 * subscription-engine.ts imports from this file (circular dep), so we mock price-map
 * to prevent it from breaking when subscription-engine loads.
 */

vi.mock('@/lib/subscriptions/price-map', () => ({
  getPricing: vi.fn(),
  resolveStripePriceId: vi.fn(),
  getStripePriceId: vi.fn(),
}));

import { getListerDowngradeWarnings } from '../lister-downgrade-warnings';
import type { ListerDowngradeContext } from '../lister-downgrade-warnings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ctx(
  current: string,
  target: string,
  rollover = 0,
  usage = 0,
  platforms = 0,
): ListerDowngradeContext {
  return {
    currentListerTier: current as never,
    targetListerTier: target as never,
    currentPublishUsage: usage,
    currentRolloverBalance: rollover,
    connectedPlatformCount: platforms,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('F4-S2: getListerDowngradeWarnings', () => {
  // ─── Upgrades and same-tier: no warnings ────────────────────────────────

  it('returns empty array for same tier (FREE→FREE)', () => {
    expect(getListerDowngradeWarnings(ctx('FREE', 'FREE'))).toHaveLength(0);
  });

  it('returns empty array for upgrade FREE→LITE', () => {
    expect(getListerDowngradeWarnings(ctx('FREE', 'LITE'))).toHaveLength(0);
  });

  it('returns empty array for upgrade LITE→PRO', () => {
    expect(getListerDowngradeWarnings(ctx('LITE', 'PRO'))).toHaveLength(0);
  });

  it('returns empty array for NONE→NONE', () => {
    expect(getListerDowngradeWarnings(ctx('NONE', 'NONE'))).toHaveLength(0);
  });

  // ─── Downgrade to NONE: critical crosslisting warning ──────────────────

  it('warns with critical severity when downgrading LITE→NONE', () => {
    const warnings = getListerDowngradeWarnings(ctx('LITE', 'NONE'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('critical');
    expect(warnings[0]!.feature).toBe('Crosslisting');
  });

  it('includes crosslisting message for PRO→NONE', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'NONE'));
    expect(warnings[0]!.message).toMatch(/crosslist/i);
  });

  // ─── PRO → LITE ─────────────────────────────────────────────────────────

  it('warns about publish limit drop on PRO→LITE (severity: warning)', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'LITE', 0, 100));
    const publishWarning = warnings.find(w => w.feature === 'Monthly Publish Limit');
    expect(publishWarning).toBeDefined();
    expect(publishWarning?.severity).toBe('warning');
  });

  it('publish limit warning contains dynamic values 2,000 and 200', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'LITE', 0, 100));
    const publishWarning = warnings.find(w => w.feature === 'Monthly Publish Limit');
    expect(publishWarning?.message).toContain('2,000');
    expect(publishWarning?.message).toContain('200');
  });

  it('warns about rollover cap drop on PRO→LITE when excess rollover exists (>600)', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'LITE', 700));
    const rolloverWarning = warnings.find(w => w.feature === 'Rollover Credits');
    expect(rolloverWarning).toBeDefined();
    expect(rolloverWarning?.severity).toBe('warning');
    expect(rolloverWarning?.message).toContain('100'); // 700 - 600 = 100 forfeited
  });

  it('does NOT warn about rollover on PRO→LITE when balance is under 600 cap', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'LITE', 400));
    const rolloverWarning = warnings.find(w => w.feature === 'Rollover Credits');
    expect(rolloverWarning).toBeUndefined();
  });

  it('publish limit warning contains current usage figure', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'LITE', 0, 1500));
    const publishWarning = warnings.find(w => w.feature === 'Monthly Publish Limit');
    expect(publishWarning?.message).toContain('1500');
  });

  // ─── LITE → FREE ─────────────────────────────────────────────────────────

  it('warns about publish limit drop on LITE→FREE with dynamic values', () => {
    const warnings = getListerDowngradeWarnings(ctx('LITE', 'FREE'));
    const publishWarning = warnings.find(w => w.feature === 'Monthly Publish Limit');
    expect(publishWarning).toBeDefined();
    expect(publishWarning?.message).toContain('200');
    expect(publishWarning?.message).toContain('25');
  });

  it('warns with critical severity about rollover forfeiture on LITE→FREE when balance > 0', () => {
    const warnings = getListerDowngradeWarnings(ctx('LITE', 'FREE', 150));
    const rolloverWarning = warnings.find(w => w.feature === 'Rollover Credits');
    expect(rolloverWarning?.severity).toBe('critical');
    expect(rolloverWarning?.message).toContain('150');
  });

  it('does NOT warn about rollover forfeiture on LITE→FREE when balance is 0', () => {
    const warnings = getListerDowngradeWarnings(ctx('LITE', 'FREE', 0));
    expect(warnings.find(w => w.feature === 'Rollover Credits')).toBeUndefined();
  });

  it('warns about AI features loss on LITE→FREE with info severity', () => {
    const warnings = getListerDowngradeWarnings(ctx('LITE', 'FREE'));
    const aiWarning = warnings.find(w => w.feature === 'AI Features');
    expect(aiWarning?.severity).toBe('info');
  });

  // ─── PRO → FREE: multiple warnings ──────────────────────────────────────

  it('generates publish limit + rollover + AI warnings on PRO→FREE', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'FREE', 300));
    const features = warnings.map(w => w.feature);
    expect(features).toContain('Monthly Publish Limit');
    expect(features).toContain('Rollover Credits');
    expect(features).toContain('AI Features');
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('rollover warning on PRO→FREE contains dynamic balance value', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'FREE', 999));
    const rolloverWarning = warnings.find(w => w.feature === 'Rollover Credits');
    expect(rolloverWarning?.message).toContain('999');
  });

  it('returns no rollover warning on PRO→FREE when balance is 0', () => {
    const warnings = getListerDowngradeWarnings(ctx('PRO', 'FREE', 0));
    expect(warnings.find(w => w.feature === 'Rollover Credits')).toBeUndefined();
  });
});
