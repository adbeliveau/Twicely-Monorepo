/**
 * Circuit breaker per platform connector.
 * Prevents the scheduler from hammering a failing external platform API.
 * Spec: Lister Canonical §8.4, §23.4
 *
 * States:
 *   CLOSED    — healthy, jobs dispatch normally
 *   OPEN      — failing, all jobs for this platform are skipped
 *   HALF_OPEN — one probe job allowed through to test recovery
 *
 * Thresholds read from platform_settings with 60-second cache.
 */

import type { ExternalChannel } from '../types';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitData {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number;
  openedAt: number;
  halfOpenAt: number;
}

const circuits = new Map<ExternalChannel, CircuitData>();

interface CBSettings {
  failureThreshold: number;
  recoveryWindowMs: number;
  halfOpenSuccesses: number;
}

let cachedSettings: CBSettings | null = null;
let settingsCacheExpiresAt = 0;

/** Load circuit breaker thresholds from platform_settings. Cached 60s. */
export async function getCBSettings(): Promise<CBSettings> {
  const now = Date.now();
  if (cachedSettings && now < settingsCacheExpiresAt) return cachedSettings;

  const [ft, rw, hos] = await Promise.all([
    getPlatformSetting<number>('crosslister.circuitBreaker.failureThreshold', 5),
    getPlatformSetting<number>('crosslister.circuitBreaker.recoveryWindowMs', 300_000),
    getPlatformSetting<number>('crosslister.circuitBreaker.halfOpenSuccesses', 2),
  ]);

  cachedSettings = {
    failureThreshold: typeof ft === 'number' && ft > 0 ? ft : 5,
    recoveryWindowMs: typeof rw === 'number' && rw > 0 ? rw : 300_000,
    halfOpenSuccesses: typeof hos === 'number' && hos > 0 ? hos : 2,
  };
  settingsCacheExpiresAt = now + 60_000;
  return cachedSettings;
}

function initCircuit(): CircuitData {
  return { state: 'CLOSED', failures: 0, successes: 0, lastFailureAt: 0, openedAt: 0, halfOpenAt: 0 };
}

/**
 * Get current circuit state for a platform.
 * Auto-transitions OPEN → HALF_OPEN when recoveryWindowMs has elapsed.
 */
export function getCircuitState(
  channel: ExternalChannel,
  recoveryWindowMs = 300_000,
): CircuitState {
  const circuit = circuits.get(channel);
  if (!circuit) return 'CLOSED';

  if (circuit.state === 'OPEN' && Date.now() - circuit.openedAt >= recoveryWindowMs) {
    circuit.state = 'HALF_OPEN';
    circuit.halfOpenAt = Date.now();
    circuit.successes = 0;
  }

  return circuit.state;
}

/**
 * Record a successful job execution for a platform.
 * CLOSED: resets failure count.
 * HALF_OPEN: increments success count; transitions to CLOSED after threshold.
 */
export function recordSuccess(
  channel: ExternalChannel,
  halfOpenSuccesses = 2,
): void {
  const circuit = circuits.get(channel) ?? initCircuit();
  if (circuit.state === 'HALF_OPEN') {
    circuit.successes += 1;
    if (circuit.successes >= halfOpenSuccesses) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.successes = 0;
    }
  } else {
    circuit.failures = 0;
  }
  circuits.set(channel, circuit);
}

/**
 * Record a failed job execution for a platform.
 * Increments failure counter. Transitions to OPEN when threshold exceeded.
 * HALF_OPEN failures immediately reopen the circuit.
 */
export function recordFailure(
  channel: ExternalChannel,
  failureThreshold = 5,
): void {
  const circuit = circuits.get(channel) ?? initCircuit();
  circuit.failures += 1;
  circuit.lastFailureAt = Date.now();

  if (circuit.state === 'HALF_OPEN' || circuit.failures >= failureThreshold) {
    circuit.state = 'OPEN';
    circuit.openedAt = Date.now();
  }

  circuits.set(channel, circuit);
}

/**
 * Returns true if a job can be dispatched for this platform.
 * CLOSED/HALF_OPEN → true, OPEN → false.
 */
export function canDispatch(
  channel: ExternalChannel,
  recoveryWindowMs = 300_000,
): boolean {
  return getCircuitState(channel, recoveryWindowMs) !== 'OPEN';
}

/** Get full circuit status for all platforms (admin dashboard §23.4). */
export function getAllCircuitStatuses(): Record<string, CircuitState> {
  const result: Record<string, CircuitState> = {};
  for (const [channel] of circuits.entries()) {
    result[channel] = getCircuitState(channel);
  }
  return result;
}

/** Reset a specific circuit (admin override). */
export function resetCircuit(channel: ExternalChannel): void {
  circuits.delete(channel);
}

/** Reset all circuits (tests only). */
export function resetAllCircuits(): void {
  circuits.clear();
  cachedSettings = null;
  settingsCacheExpiresAt = 0;
}
