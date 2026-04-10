'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl/authorize';
import { createBundleOffer } from '@twicely/commerce/bundle-offers';
import { createBundleOfferSchema } from '@/lib/validations/offers';
import { z } from 'zod';

interface ActionResult {
  success: boolean;
  error?: string;
  offerId?: string;
  orderId?: string;
  orderNumber?: string;
  autoAccepted?: boolean;
}

/**
 * Create a bundle offer for multiple items from the same seller.
 */
export async function createBundleOfferAction(
  data: z.infer<typeof createBundleOfferSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to make an offer' };
  }

  if (!ability.can('create', 'Offer')) {
    return { success: false, error: 'You do not have permission to create offers' };
  }

  const parsed = createBundleOfferSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await createBundleOffer({
    buyerId: session.userId,
    sellerId: '', // Will be validated from listings
    listingIds: parsed.data.listingIds,
    offeredPriceCents: parsed.data.offeredPriceCents,
    shippingAddressId: parsed.data.shippingAddressId,
    paymentMethodId: parsed.data.paymentMethodId,
    message: parsed.data.message,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath('/my/buying/offers');

  return { success: true, offerId: result.offer?.id };
}
