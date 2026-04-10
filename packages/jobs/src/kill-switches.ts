/**
 * Kill Switches — fast feature kill switches backed by an in-memory store.
 *
 * Each switch can be toggled by staff and checked in hot paths.
 * Production deployments should replace the in-memory Map with Valkey.
 */

import { logger } from '@twicely/logger';

export const KILL_SWITCHES = [
  'killCheckout',
  'killPayouts',
  'killImports',
  'killPublish',
  'killRegistration',
  'killLocalTransactions',
  'killAuthentication',
  'readOnlyMode',
] as const;

export type KillSwitchName = typeof KILL_SWITCHES[number];

// ── In-memory state store ───────────────────────────────────────────────
const switchState = new Map<KillSwitchName, { active: boolean; toggledByStaffId: string; toggledAt: Date }>();

/**
 * Check if a kill switch is currently active.
 * Returns false if the switch has never been toggled.
 */
export async function isKillSwitchActive(name: KillSwitchName): Promise<boolean> {
  const entry = switchState.get(name);
  return entry?.active ?? false;
}

/**
 * Toggle a kill switch on or off.
 */
export async function toggleKillSwitch(
  name: KillSwitchName,
  active: boolean,
  staffId: string,
): Promise<void> {
  const previous = switchState.get(name);
  const wasActive = previous?.active ?? false;

  switchState.set(name, {
    active,
    toggledByStaffId: staffId,
    toggledAt: new Date(),
  });

  if (wasActive !== active) {
    logger.warn('[killSwitch] Toggled', { name, active, staffId });
  }
}

/**
 * Return the current state of all kill switches.
 */
export async function getAllKillSwitches(): Promise<Record<KillSwitchName, boolean>> {
  const result = {} as Record<KillSwitchName, boolean>;
  for (const name of KILL_SWITCHES) {
    const entry = switchState.get(name);
    result[name] = entry?.active ?? false;
  }
  return result;
}

/**
 * Reset all kill switch state. Primarily used in tests.
 */
export function resetAllKillSwitches(): void {
  switchState.clear();
}
