/**
 * Tests for getEvaluatedFlags server helper (G10.5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockIsFeatureEnabled = vi.fn();
vi.mock('@/lib/services/feature-flags', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getEvaluatedFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('evaluates multiple flags in parallel', async () => {
    mockIsFeatureEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    const result = await getEvaluatedFlags(['kill.checkout', 'gate.marketplace']);

    expect(mockIsFeatureEnabled).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ 'kill.checkout': true, 'gate.marketplace': false });
  });

  it('returns Record<string, boolean> with correct evaluations', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    const result = await getEvaluatedFlags(['feature.a', 'feature.b']);

    expect(typeof result['feature.a']).toBe('boolean');
    expect(typeof result['feature.b']).toBe('boolean');
  });

  it('returns empty object for empty keys array', async () => {
    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    const result = await getEvaluatedFlags([]);

    expect(result).toEqual({});
    expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it('defaults to false for unknown flag keys', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);

    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    const result = await getEvaluatedFlags(['no.such.flag']);

    expect(result['no.such.flag']).toBe(false);
  });

  it('passes userId to isFeatureEnabled when provided', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    await getEvaluatedFlags(['feature.pct'], 'user-xyz');

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('feature.pct', {
      userId: 'user-xyz',
    });
  });

  it('does not pass userId when undefined', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);

    const { getEvaluatedFlags } = await import('../get-evaluated-flags');
    await getEvaluatedFlags(['feature.pct']);

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('feature.pct', {
      userId: undefined,
    });
  });
});
