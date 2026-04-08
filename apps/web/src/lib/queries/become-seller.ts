/**
 * Become Seller Page Queries (G10.9)
 * Loads pricing data from platform_settings and seller status for CTA routing.
 * No mutations — read-only.
 */

import { db } from '@twicely/db';
import { user, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getTfBrackets } from '@twicely/commerce/tf-calculator';
import { getPlatformSettingsByPrefix } from '@/lib/queries/platform-settings';

export interface TfBracket {
  bracketNumber: number;
  maxCents: number | null;
  rateBps: number;
}

export interface StoreTierCard {
  tier: string;
  monthlyCents: number | null;
  freeListings: number;
  insertionFeeCents: number;
  keyFeatures: string[];
}

export interface CrosslisterTierCard {
  tier: string;
  monthlyCents: number | null;
  publishesPerMonth: number;
  keyFeatures: string[];
}

export interface BecomeSelllerPricingData {
  storeTiers: StoreTierCard[];
  crosslisterTiers: CrosslisterTierCard[];
  tfBrackets: TfBracket[];
  automationMonthlyCents: number;
}

function num(map: Map<string, unknown>, key: string, fallback: number): number {
  const v = map.get(key);
  if (typeof v === 'number') return v;
  return fallback;
}

export async function getBecomeSelllerPricing(): Promise<BecomeSelllerPricingData> {
  const [
    storeMap,
    crosslisterPricingMap,
    crosslisterPublishesMap,
    feesInsertionMap,
    freeListingsMap,
    automationMap,
    canonicalBrackets,
  ] = await Promise.all([
    getPlatformSettingsByPrefix('store.pricing.'),
    getPlatformSettingsByPrefix('crosslister.pricing.'),
    getPlatformSettingsByPrefix('crosslister.publishes.'),
    getPlatformSettingsByPrefix('fees.insertion.'),
    getPlatformSettingsByPrefix('fees.freeListings.'),
    getPlatformSettingsByPrefix('automation.pricing.'),
    getTfBrackets(),
  ]);

  const storeTiers: StoreTierCard[] = [
    {
      tier: 'NONE',
      monthlyCents: 0,
      freeListings: num(freeListingsMap, 'fees.freeListings.NONE', 100),
      insertionFeeCents: num(feesInsertionMap, 'fees.insertion.NONE', 35),
      keyFeatures: ['Manual payout', 'Standard support', 'All listing tools'],
    },
    {
      tier: 'STARTER',
      monthlyCents: num(storeMap, 'store.pricing.starter.monthlyCents', 1200),
      freeListings: num(freeListingsMap, 'fees.freeListings.STARTER', 250),
      insertionFeeCents: num(feesInsertionMap, 'fees.insertion.STARTER', 25),
      keyFeatures: ['Weekly auto-payout', 'Announcement bar', 'Store branding'],
    },
    {
      tier: 'PRO',
      monthlyCents: num(storeMap, 'store.pricing.pro.monthlyCents', 3999),
      freeListings: num(freeListingsMap, 'fees.freeListings.PRO', 2000),
      insertionFeeCents: num(feesInsertionMap, 'fees.insertion.PRO', 10),
      keyFeatures: ['Analytics dashboard', 'Bulk listing tools', 'Listing boosting'],
    },
    {
      tier: 'POWER',
      monthlyCents: num(storeMap, 'store.pricing.power.monthlyCents', 7999),
      freeListings: num(freeListingsMap, 'fees.freeListings.POWER', 15000),
      insertionFeeCents: num(feesInsertionMap, 'fees.insertion.POWER', 5),
      keyFeatures: ['Puck page builder', 'Daily auto-payout', 'Priority support'],
    },
  ];

  const crosslisterTiers: CrosslisterTierCard[] = [
    {
      tier: 'FREE',
      monthlyCents: 0,
      publishesPerMonth: num(crosslisterPublishesMap, 'crosslister.publishes.FREE', 5),
      keyFeatures: ['Import from eBay, Poshmark, and more', 'Basic sync'],
    },
    {
      tier: 'LITE',
      monthlyCents: num(crosslisterPricingMap, 'crosslister.pricing.lite.monthlyCents', 1399),
      publishesPerMonth: num(crosslisterPublishesMap, 'crosslister.publishes.LITE', 200),
      keyFeatures: ['AI listing credits', 'Background removal', 'Multi-platform sync'],
    },
    {
      tier: 'PRO',
      monthlyCents: num(crosslisterPricingMap, 'crosslister.pricing.pro.monthlyCents', 3999),
      publishesPerMonth: num(crosslisterPublishesMap, 'crosslister.publishes.PRO', 2000),
      keyFeatures: ['High-volume publishes', 'Priority AI credits', 'Advanced sync'],
    },
  ];

  // Use canonical brackets from @twicely/commerce — single source of truth.
  // getTfBrackets() reads from platform_settings (commerce.tf.bracket*) and falls back
  // to DEFAULT_TF_BRACKETS (tiered 10% → 8%) if the table is empty. Never returns
  // a flat 10% across all brackets.
  const tfBrackets: TfBracket[] = canonicalBrackets.map((bracket, i) => ({
    bracketNumber: i + 1,
    maxCents: bracket.maxCents,
    rateBps: bracket.rateBps,
  }));

  const automationMonthlyCents = num(automationMap, 'automation.pricing.monthlyCents', 1299);

  return { storeTiers, crosslisterTiers, tfBrackets, automationMonthlyCents };
}

export interface SellerStatusForCta {
  isSeller: boolean;
  sellerType: 'PERSONAL' | 'BUSINESS' | null;
}

export async function getSellerStatusForCtaRouting(userId: string): Promise<SellerStatusForCta> {
  const [userRow] = await db
    .select({ isSeller: user.isSeller })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userRow || !userRow.isSeller) {
    return { isSeller: false, sellerType: null };
  }

  const [profileRow] = await db
    .select({ sellerType: sellerProfile.sellerType })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profileRow) {
    return { isSeller: true, sellerType: null };
  }

  return { isSeller: true, sellerType: profileRow.sellerType };
}
