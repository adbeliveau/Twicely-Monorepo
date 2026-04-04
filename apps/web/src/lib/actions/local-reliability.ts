'use server';

import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { authorize } from '@twicely/casl';
import { getReliabilityDisplay } from '@twicely/commerce/local-reliability';
import type { ReliabilityDisplay } from '@twicely/commerce/local-reliability';

// ─── Schema ──────────────────────────────────────────────────────────────────

const getReliabilitySchema = z.object({
  userId: zodId,
}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReliabilityResult {
  success: boolean;
  data?: ReliabilityDisplay;
  error?: string;
}

// ─── Action ──────────────────────────────────────────────────────────────────

/**
 * Get reliability display data for a user.
 * Used on the local meetup screen to show the counterparty's reliability tier.
 * Returns: tier (RELIABLE/INCONSISTENT/UNRELIABLE), completedCount,
 * completionRate, suspension status.
 */
export async function getReliabilityDisplayAction(
  userId: string
): Promise<ReliabilityResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }
  if (!ability.can('read', 'LocalReliabilityEvent')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = getReliabilitySchema.safeParse({ userId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const data = await getReliabilityDisplay(parsed.data.userId);

  return { success: true, data };
}
