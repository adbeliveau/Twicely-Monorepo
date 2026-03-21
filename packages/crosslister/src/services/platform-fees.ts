/**
 * Platform fee rate lookup and calculation for off-platform sales.
 * Rates stored in platform_settings — NEVER hardcoded.
 * Source: F5-S1 install prompt §1.5; Decision #31 (no fees on off-platform sales in Twicely ledger)
 *
 * These fees are INFORMATIONAL only — used for seller profit display.
 * No ledger entries are created for off-platform fees (F5-S2 handles Twicely-side ledger).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { ExternalChannel } from '../types';

/** Map of ExternalChannel to its platform_settings key segment. */
const CHANNEL_FEE_KEY: Record<ExternalChannel, string> = {
  EBAY: 'ebay',
  POSHMARK: 'poshmark',
  MERCARI: 'mercari',
  DEPOP: 'depop',
  FB_MARKETPLACE: 'facebook',
  ETSY: 'etsy',
  GRAILED: 'grailed',
  THEREALREAL: 'therealreal',
  WHATNOT: 'whatnot',
  SHOPIFY: 'shopify',
  VESTIAIRE: 'vestiaire',
};

/**
 * Default fee rates in basis points (fallback when setting not found).
 * Source: F5-S1 install prompt §1.5
 */
const DEFAULT_FEE_RATES_BPS: Record<ExternalChannel, number> = {
  EBAY: 1290,         // 12.9%
  POSHMARK: 2000,     // 20%
  MERCARI: 1000,      // 10%
  DEPOP: 1000,        // 10%
  FB_MARKETPLACE: 500, // 5%
  ETSY: 1300,         // 13%
  GRAILED: 1000,      // 10% (fallback)
  THEREALREAL: 2000,  // 20% (fallback — The RealReal charges high commission)
  WHATNOT: 1000,      // 10% (fallback — pending confirmed rate from Whatnot)
  SHOPIFY: 290,       // 2.9% (Shopify Payments processing fee — informational only)
  VESTIAIRE: 1500,    // 15%
};

/**
 * Look up the platform fee rate for a channel from platform_settings.
 * Returns the rate in basis points (e.g. 1290 = 12.9%).
 * Falls back to DEFAULT_FEE_RATES_BPS if setting not found.
 */
export async function getPlatformFeeRate(channel: ExternalChannel): Promise<number> {
  const keySegment = CHANNEL_FEE_KEY[channel];
  const settingKey = `crosslister.fees.${keySegment}.rateBps`;

  try {
    const [row] = await db
      .select({ value: platformSetting.value })
      .from(platformSetting)
      .where(eq(platformSetting.key, settingKey))
      .limit(1);

    if (row !== undefined && row.value !== null) {
      const parsed = Number(row.value);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    logger.warn('[platformFees] Failed to load fee rate from settings — using default', {
      channel,
      settingKey,
      error: String(err),
    });
  }

  const defaultRate = DEFAULT_FEE_RATES_BPS[channel];
  return defaultRate;
}

/**
 * Calculate the platform fee in cents given a sale price and fee rate.
 * Always returns an integer (rounded up to nearest cent).
 * Source: F5-S1 install prompt §1.5
 */
export function calculatePlatformFee(salePriceCents: number, feeRateBps: number): number {
  return Math.round(salePriceCents * feeRateBps / 10000);
}

/**
 * Human-like delay for Tier-C (session-based) connectors.
 * Reads min/max from platform_settings with safe defaults.
 */
export async function tierCDelay(): Promise<void> {
  const delayMin = await getPlatformSetting<number>('crosslister.tierC.delayMinMs', 2000);
  const delayMax = await getPlatformSetting<number>('crosslister.tierC.delayMaxMs', 8000);
  await new Promise((resolve) => setTimeout(resolve, delayMin + Math.random() * (delayMax - delayMin)));
}
