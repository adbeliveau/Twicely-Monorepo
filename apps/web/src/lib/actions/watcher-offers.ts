'use server';

/**
 * Watcher Offer Server Actions
 * Wraps @twicely/commerce/watcher-offers for client component consumption.
 */

import { authorize } from '@twicely/casl';
import {
  acceptWatcherOffer,
  createWatcherOffer,
  cancelWatcherOffer,
} from '@twicely/commerce/watcher-offers';

export async function acceptWatcherOfferAction(params: {
  watcherOfferId: string;
  shippingAddressId: string;
}) {
  const { session } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  return acceptWatcherOffer(params);
}

export async function createWatcherOfferAction(params: {
  listingId: string;
  discountedPriceCents: number;
}) {
  const { session } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  return createWatcherOffer(params);
}

export async function cancelWatcherOfferAction(watcherOfferId: string) {
  const { session } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  return cancelWatcherOffer(watcherOfferId);
}
