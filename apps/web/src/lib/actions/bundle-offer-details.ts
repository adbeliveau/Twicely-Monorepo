'use server';

import { authorize } from '@twicely/casl/authorize';
import { getBundleOfferDetails } from '@twicely/commerce/bundle-offers';
import { z } from 'zod';

const getBundleOfferDetailsSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
}).strict();

interface BundleItem {
  listingId: string;
  title: string | null;
  priceCents: number | null;
  slug: string | null;
}

interface BundleOfferDetailsResult {
  success: boolean;
  error?: string;
  offer?: {
    id: string;
    offerCents: number;
    status: string;
    type: string;
    buyerId: string;
    sellerId: string;
    bundleItems: BundleItem[];
    totalListPriceCents: number;
    createdAt: Date;
    expiresAt: Date;
    message: string | null;
  };
}

/**
 * Fetch bundle offer details (accessible to buyer or seller of the offer).
 * Requires authorize() + ability.can('read', 'Offer') + Zod validation.
 */
export async function getBundleOfferDetailsAction(
  data: z.infer<typeof getBundleOfferDetailsSchema>
): Promise<BundleOfferDetailsResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('read', 'Offer')) {
    return { success: false, error: 'You do not have permission to view offers' };
  }

  const parsed = getBundleOfferDetailsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const details = await getBundleOfferDetails(parsed.data.offerId);
  if (!details) {
    return { success: false, error: 'Not found' };
  }

  // Verify the current user is either the buyer or seller of this offer
  if (details.buyerId !== session.userId && details.sellerId !== session.userId) {
    return { success: false, error: 'Not found' };
  }

  return {
    success: true,
    offer: {
      id: details.id,
      offerCents: details.offerCents,
      status: details.status,
      type: details.type,
      buyerId: details.buyerId,
      sellerId: details.sellerId,
      bundleItems: details.bundleItems,
      totalListPriceCents: details.totalListPriceCents,
      createdAt: details.createdAt,
      expiresAt: details.expiresAt,
      message: details.message,
    },
  };
}
