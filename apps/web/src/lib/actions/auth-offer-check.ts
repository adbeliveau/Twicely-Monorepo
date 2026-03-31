'use server';

import { z } from 'zod';
import { qualifiesForAuthOffer, getAuthOfferConfig } from '@twicely/commerce/auth-offer';

// ─── Schema ──────────────────────────────────────────────────────────────────

const checkAuthOfferSchema = z.object({
  itemPriceCents: z.number().int().nonnegative(),
}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthOfferCheckResult {
  qualifies: boolean;
  thresholdCents: number;
  buyerFeeCents: number;
}

// ─── Action ──────────────────────────────────────────────────────────────────

/**
 * Check if a cart item qualifies for authentication offer.
 * Used in the checkout flow to determine whether to show the authentication option.
 * Reads threshold + fee from platform_settings (never hardcoded).
 */
export async function checkAuthOfferAction(
  itemPriceCents: number
): Promise<AuthOfferCheckResult> {
  const parsed = checkAuthOfferSchema.safeParse({ itemPriceCents });
  if (!parsed.success) {
    return { qualifies: false, thresholdCents: 0, buyerFeeCents: 0 };
  }

  const [qualifies, config] = await Promise.all([
    qualifiesForAuthOffer(parsed.data.itemPriceCents),
    getAuthOfferConfig(),
  ]);

  return {
    qualifies,
    thresholdCents: config.thresholdCents,
    buyerFeeCents: config.buyerFeeCents,
  };
}
