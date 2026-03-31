'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { authorize } from '@twicely/casl';
import { createCounterfeitClaim } from '@twicely/commerce/buyer-protection';

// ─── Schema ──────────────────────────────────────────────────────────────────

const counterfeitClaimSchema = z.object({
  orderId: zodId,
  description: z.string().min(10, 'Please provide at least 10 characters').max(2000),
  photos: z.array(z.string().url()).min(1, 'Photo evidence is required for counterfeit claims').max(10),
}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

// ─── Action ──────────────────────────────────────────────────────────────────

/**
 * Submit a counterfeit claim for an order.
 * 60-day claim window from delivery. Photo evidence required.
 * Called from the buyer protection claim form when COUNTERFEIT reason is selected.
 */
export async function createCounterfeitClaimAction(
  data: z.infer<typeof counterfeitClaimSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!ability.can('create', 'Dispute')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = counterfeitClaimSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await createCounterfeitClaim(
    session.userId,
    parsed.data.orderId,
    parsed.data.description,
    parsed.data.photos,
  );

  if (result.success) {
    revalidatePath('/my/buying/orders');
    revalidatePath('/my/disputes');
  }

  return result;
}
