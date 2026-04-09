'use server';

/**
 * Multi-order finalization action (multi-seller checkout).
 * Split from checkout-finalize.ts to stay under 300 lines.
 */

import { authorize } from '@twicely/casl';
import { finalizeOrdersSchema } from '@/lib/validations/checkout-finalize';
import { finalizeOrder } from './checkout-finalize';

interface FinalizeOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Finalize multiple orders (for multi-seller checkout).
 * Calls finalizeOrder for each paymentIntentId.
 */
export async function finalizeOrders(paymentIntentIds: string[]): Promise<FinalizeOrderResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('create', 'Order')) {
    return { success: false, error: 'Not authorized to create orders' };
  }

  const parsed = finalizeOrdersSchema.safeParse({ paymentIntentIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  for (const piId of paymentIntentIds) {
    const result = await finalizeOrder(piId);
    if (!result.success) {
      return result;
    }
  }
  return { success: true };
}
