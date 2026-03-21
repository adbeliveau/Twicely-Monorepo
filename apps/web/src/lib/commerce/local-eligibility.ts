/**
 * Local Transaction Eligibility Check
 *
 * Determines whether a user may participate in local pickup transactions.
 * Per TWICELY_V3_LOCAL_CANONICAL.md §7 — suspended users cannot initiate
 * or accept local transactions until their suspension window expires.
 */

import { isUserSuspendedFromLocal } from './local-reliability';

export interface LocalEligibilityResult {
  eligible: boolean;
  reason?: string;
  resumesAt?: Date;
}

/**
 * Check if a user is eligible to participate in local pickup transactions.
 *
 * Returns eligible: false with a generic reason if the user is suspended.
 * resumesAt is included so callers can show "try again after X" messaging.
 */
export async function checkLocalEligibility(
  userId: string,
): Promise<LocalEligibilityResult> {
  const suspension = await isUserSuspendedFromLocal(userId);

  if (suspension.suspended) {
    return {
      eligible: false,
      reason: 'Local transactions are temporarily unavailable for your account.',
      resumesAt: suspension.resumesAt,
    };
  }

  return { eligible: true };
}
