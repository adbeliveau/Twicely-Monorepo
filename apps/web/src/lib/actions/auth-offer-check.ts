'use server';

import { z } from 'zod';
import { authorize } from '@twicely/casl';
import { qualifiesForAuthOffer, getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── Schema ──────────────────────────────────────────────────────────────────

const checkAuthOfferSchema = z.object({
  itemPriceCents: z.number().int().nonnegative(),
}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthTierOption {
  tier: 'AI' | 'EXPERT';
  label: string;
  feeCents: number;
}

interface AuthOfferCheckResult {
  qualifies: boolean;
  thresholdCents: number;
  buyerFeeCents: number;
  tiers: AuthTierOption[];
}

// ─── Action ──────────────────────────────────────────────────────────────────

/**
 * Check if a cart item qualifies for authentication offer.
 * Used in the checkout flow to determine whether to show the authentication option.
 * When AI auth is enabled, returns both AI ($19.99) and Expert ($39.99) tiers.
 * Reads threshold + fee from platform_settings (never hardcoded).
 */
export async function checkAuthOfferAction(
  itemPriceCents: number
): Promise<AuthOfferCheckResult> {
  const { session } = await authorize();
  if (!session) {
    return { qualifies: false, thresholdCents: 0, buyerFeeCents: 0, tiers: [] };
  }

  const parsed = checkAuthOfferSchema.safeParse({ itemPriceCents });
  if (!parsed.success) {
    return { qualifies: false, thresholdCents: 0, buyerFeeCents: 0, tiers: [] };
  }

  const [qualifies, config, aiEnabled, aiFeeCents, expertFeeCents] = await Promise.all([
    qualifiesForAuthOffer(parsed.data.itemPriceCents),
    getAuthOfferConfig(),
    getPlatformSetting<boolean>('trust.authentication.aiEnabled', false),
    getPlatformSetting<number>('trust.authentication.aiFeeCents', 1999),
    getPlatformSetting<number>('trust.authentication.expertFeeCents', 3999),
  ]);

  const tiers: AuthTierOption[] = [];

  if (qualifies) {
    if (aiEnabled) {
      tiers.push({ tier: 'AI', label: 'AI Authentication', feeCents: aiFeeCents });
    }
    tiers.push({ tier: 'EXPERT', label: 'Expert Authentication', feeCents: expertFeeCents });
  }

  return {
    qualifies,
    thresholdCents: config.thresholdCents,
    buyerFeeCents: config.buyerFeeCents,
    tiers,
  };
}
