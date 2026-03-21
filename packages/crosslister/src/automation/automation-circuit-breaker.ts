/**
 * Per-seller automation circuit breaker.
 * Escalating pause: 3 failures → 1 hour, 5 failures → 24 hours.
 * Spec: Lister Canonical Section 16.3.
 *
 * In-memory (V1). Valkey-backed version planned for Phase G.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

interface SellerCircuitState {
  consecutiveFailures: number;
  pausedUntil: number; // epoch ms, 0 = not paused
}

const sellerCircuits = new Map<string, SellerCircuitState>();

// Cache thresholds (read once, cached for process lifetime)
let thresholds: {
  level1Failures: number;
  level1PauseMs: number;
  level2Failures: number;
  level2PauseMs: number;
} | null = null;

async function loadThresholds() {
  if (thresholds) return thresholds;
  const [l1f, l1p, l2f, l2p] = await Promise.all([
    getPlatformSetting<number>('automation.circuitBreaker.level1Failures', 3),
    getPlatformSetting<number>('automation.circuitBreaker.level1PauseMs', 3_600_000),
    getPlatformSetting<number>('automation.circuitBreaker.level2Failures', 5),
    getPlatformSetting<number>('automation.circuitBreaker.level2PauseMs', 86_400_000),
  ]);
  thresholds = {
    level1Failures: l1f,
    level1PauseMs: l1p,
    level2Failures: l2f,
    level2PauseMs: l2p,
  };
  return thresholds;
}

export async function canPerformAutomation(sellerId: string): Promise<boolean> {
  const state = sellerCircuits.get(sellerId);
  if (!state) return true;
  if (state.pausedUntil === 0) return true;
  if (Date.now() >= state.pausedUntil) {
    // Pause expired — allow but don't reset failures (next failure re-pauses)
    state.pausedUntil = 0;
    return true;
  }
  return false;
}

export async function recordAutomationSuccess(sellerId: string): Promise<void> {
  // Success resets consecutive failures entirely
  sellerCircuits.set(sellerId, { consecutiveFailures: 0, pausedUntil: 0 });
}

export async function recordAutomationFailure(sellerId: string): Promise<void> {
  const t = await loadThresholds();
  const state = sellerCircuits.get(sellerId) ?? { consecutiveFailures: 0, pausedUntil: 0 };
  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= t.level2Failures) {
    state.pausedUntil = Date.now() + t.level2PauseMs;
    logger.warn('[automationCircuitBreaker] Level 2 pause (24h)', {
      sellerId,
      failures: state.consecutiveFailures,
    });
  } else if (state.consecutiveFailures >= t.level1Failures) {
    state.pausedUntil = Date.now() + t.level1PauseMs;
    logger.warn('[automationCircuitBreaker] Level 1 pause (1h)', {
      sellerId,
      failures: state.consecutiveFailures,
    });
  }

  sellerCircuits.set(sellerId, state);
}

/** Reset all circuits (tests only). */
export function resetAllSellerCircuits(): void {
  sellerCircuits.clear();
  thresholds = null;
}
