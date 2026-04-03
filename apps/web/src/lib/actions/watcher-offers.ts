'use server';

/**
 * Watcher Offer Server Actions
 * Wraps @twicely/commerce/watcher-offers for client component consumption.
 */

import { authorize, sub } from '@twicely/casl';
import {
  acceptWatcherOffer,
  createWatcherOffer,
  cancelWatcherOffer,
} from '@twicely/commerce/watcher-offers';

export async function acceptWatcherOfferAction(params: {
  watcherOfferId: string;
  shippingAddressId: string;
}) {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('update', sub('Offer', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }
  return acceptWatcherOffer(params);
}

export async function createWatcherOfferAction(params: {
  listingId: string;
  discountedPriceCents: number;
}) {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('create', sub('Offer', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }
  return createWatcherOffer(params);
}

export async function cancelWatcherOfferAction(watcherOfferId: string) {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('delete', sub('Offer', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }
  return cancelWatcherOffer(watcherOfferId);
}
