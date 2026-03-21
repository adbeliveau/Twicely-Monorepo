/**
 * Authentication Offer (B3.5)
 *
 * For items priced $500+, buyers are offered optional authentication.
 * The buyer pays $19.99 upfront; the actual authentication flow (D6) is separate.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

/** Default threshold in cents (fallback if platform_settings unavailable) */
const DEFAULT_AUTH_OFFER_THRESHOLD_CENTS = 50000; // $500

/** Default buyer authentication fee in cents (fallback) */
const DEFAULT_AUTH_BUYER_FEE_CENTS = 1999; // $19.99

/** Load auth offer config from platform_settings. */
export async function getAuthOfferConfig(): Promise<{
  thresholdCents: number;
  buyerFeeCents: number;
}> {
  const [threshold, fee] = await Promise.all([
    getPlatformSetting<number>('commerce.auth.offerThresholdCents', DEFAULT_AUTH_OFFER_THRESHOLD_CENTS),
    getPlatformSetting<number>('commerce.auth.buyerFeeCents', DEFAULT_AUTH_BUYER_FEE_CENTS),
  ]);
  return { thresholdCents: threshold, buyerFeeCents: fee };
}

/**
 * Determines if a cart item qualifies for authentication offer.
 * @param itemPriceCents - The item's price in cents
 * @returns true if the item meets the threshold from platform_settings
 */
export async function qualifiesForAuthOffer(itemPriceCents: number): Promise<boolean> {
  const config = await getAuthOfferConfig();
  return itemPriceCents >= config.thresholdCents;
}
