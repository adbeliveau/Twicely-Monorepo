/**
 * Circuit Breaker — in-memory circuit breaker with platform_settings-driven thresholds.
 *
 * State machine: CLOSED -> (N failures) -> OPEN -> (timeout elapsed) -> HALF_OPEN -> (success) -> CLOSED / (failure) -> OPEN
 *
 * Production deployments should replace the in-memory store with Valkey for cross-instance state sharing.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { CheckResult } from './health-persistence';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export const PROTECTED_SERVICES = ['stripe', 'typesense', 'centrifugo', 'resend', 'shippo', 'r2'] as const;
export type ProtectedService = typeof PROTECTED_SERVICES[number];

// ── In-memory state store (Valkey replacement in production) ────────────
interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number;
  openedAt: number;
}

const circuits = new Map<string, CircuitEntry>();

function getEntry(service: string): CircuitEntry {
  let entry = circuits.get(service);
  if (!entry) {
    entry = { state: 'CLOSED', failureCount: 0, lastFailureAt: 0, openedAt: 0 };
    circuits.set(service, entry);
  }
  return entry;
}

// ── Configuration (read from platform_settings) ────────────────────────
async function getFailureThreshold(): Promise<number> {
  return getPlatformSetting<number>('health.circuit.failureThreshold', 3);
}

async function getOpenDurationMs(): Promise<number> {
  const seconds = await getPlatformSetting<number>('health.circuit.openDurationSeconds', 30);
  return seconds * 1000;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get the current circuit state for a service.
 * Automatically transitions OPEN -> HALF_OPEN when the timeout has elapsed.
 */
export async function getCircuitState(service: string): Promise<CircuitState> {
  const entry = getEntry(service);

  if (entry.state === 'OPEN') {
    const openDurationMs = await getOpenDurationMs();
    if (Date.now() - entry.openedAt >= openDurationMs) {
      entry.state = 'HALF_OPEN';
      logger.info('[circuitBreaker] Transitioned to HALF_OPEN', { service });
    }
  }

  return entry.state;
}

/**
 * Record a successful operation — resets circuit to CLOSED.
 */
export async function recordCircuitSuccess(service: string): Promise<void> {
  const entry = getEntry(service);
  const previousState = entry.state;

  entry.state = 'CLOSED';
  entry.failureCount = 0;

  if (previousState !== 'CLOSED') {
    logger.info('[circuitBreaker] Circuit closed after success', { service, previousState });
  }
}

/**
 * Record a failed operation — may trip the circuit to OPEN.
 */
export async function recordCircuitFailure(service: string): Promise<void> {
  const entry = getEntry(service);
  const threshold = await getFailureThreshold();

  entry.failureCount++;
  entry.lastFailureAt = Date.now();

  if (entry.state === 'HALF_OPEN') {
    // Any failure in HALF_OPEN immediately re-opens
    entry.state = 'OPEN';
    entry.openedAt = Date.now();
    logger.warn('[circuitBreaker] Circuit re-opened from HALF_OPEN', { service });
    return;
  }

  if (entry.state === 'CLOSED' && entry.failureCount >= threshold) {
    entry.state = 'OPEN';
    entry.openedAt = Date.now();
    logger.warn('[circuitBreaker] Circuit opened', { service, failureCount: entry.failureCount, threshold });
  }
}

/**
 * Check if a circuit is currently OPEN (requests should be short-circuited).
 */
export async function isCircuitOpen(service: string): Promise<boolean> {
  const state = await getCircuitState(service);
  return state === 'OPEN';
}

/**
 * Return the circuit state for all protected services.
 */
export async function getAllCircuitStates(): Promise<Record<string, CircuitState>> {
  const result: Record<string, CircuitState> = {};
  for (const service of PROTECTED_SERVICES) {
    result[service] = await getCircuitState(service);
  }
  return result;
}

/**
 * Update circuit breaker states based on health check results.
 * Maps check names to protected services and records success/failure.
 */
export async function updateCircuitBreakersFromHealth(checks: CheckResult[]): Promise<void> {
  for (const check of checks) {
    // Match check module to a protected service
    const service = PROTECTED_SERVICES.find(
      (s) => check.module.toLowerCase() === s || check.checkName.toLowerCase().includes(s),
    );

    if (!service) continue;

    if (check.status === 'HEALTHY') {
      await recordCircuitSuccess(service);
    } else if (check.status === 'UNHEALTHY') {
      await recordCircuitFailure(service);
    }
    // DEGRADED and UNKNOWN do not trip the breaker
  }
}

/**
 * Reset all circuit breaker state. Primarily used in tests.
 */
export function resetAllCircuits(): void {
  circuits.clear();
}
