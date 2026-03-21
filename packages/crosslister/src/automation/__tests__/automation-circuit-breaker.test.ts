import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import {
  canPerformAutomation,
  recordAutomationSuccess,
  recordAutomationFailure,
  resetAllSellerCircuits,
} from '../automation-circuit-breaker';

const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

// Test thresholds: level1 at 3 failures (1h pause), level2 at 5 failures (24h pause)
function setupThresholds() {
  mockGetPlatformSetting.mockImplementation(
    (key: string, defaultValue: unknown) => {
      if (key === 'automation.circuitBreaker.level1Failures') return Promise.resolve(3);
      if (key === 'automation.circuitBreaker.level1PauseMs') return Promise.resolve(3_600_000);
      if (key === 'automation.circuitBreaker.level2Failures') return Promise.resolve(5);
      if (key === 'automation.circuitBreaker.level2PauseMs') return Promise.resolve(86_400_000);
      return Promise.resolve(defaultValue);
    }
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  resetAllSellerCircuits();
  setupThresholds();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('canPerformAutomation', () => {
  it('returns true when no failures recorded', async () => {
    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });

  it('returns true after fewer than level1 failures', async () => {
    await recordAutomationFailure('seller1'); // 1 failure
    await recordAutomationFailure('seller1'); // 2 failures
    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });

  it('returns false after 3 consecutive failures (level 1 pause)', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // triggers level1
    const result = await canPerformAutomation('seller1');
    expect(result).toBe(false);
  });

  it('returns false after 5 consecutive failures (level 2 pause)', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // triggers level2
    const result = await canPerformAutomation('seller1');
    expect(result).toBe(false);
  });

  it('returns true after level 1 pause expires', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // triggers level1 (1h)

    // Fast-forward past 1 hour
    vi.advanceTimersByTime(3_600_001);

    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });

  it('returns false before level 1 pause expires', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // triggers level1 (1h)

    // Advance only 30 minutes
    vi.advanceTimersByTime(1_800_000);

    const result = await canPerformAutomation('seller1');
    expect(result).toBe(false);
  });
});

describe('recordAutomationSuccess', () => {
  it('resets consecutive failures to 0', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationSuccess('seller1'); // resets
    // After reset, 2 more failures should NOT trigger level1 (only 2, not 3)
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });

  it('recordAutomationSuccess after pause allows automation again', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // paused

    // Confirm paused
    expect(await canPerformAutomation('seller1')).toBe(false);

    await recordAutomationSuccess('seller1'); // clears state

    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });
});

describe('resetAllSellerCircuits', () => {
  it('clears all state', async () => {
    vi.useFakeTimers();
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1');
    await recordAutomationFailure('seller1'); // paused

    resetAllSellerCircuits();

    const result = await canPerformAutomation('seller1');
    expect(result).toBe(true);
  });
});
