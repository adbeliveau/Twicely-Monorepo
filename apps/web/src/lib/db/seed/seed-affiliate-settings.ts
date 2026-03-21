/**
 * Affiliate & Trial Platform Settings (G1.2)
 *
 * 24 settings from TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL Section 6.
 * All values read at runtime from platform_settings — never hardcoded in app code.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const AFFILIATE_TRIAL_SETTINGS: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AFFILIATE PROGRAM (12 keys)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'affiliate.enabled', value: true, type: 'boolean', category: 'affiliate', description: 'Master switch for affiliate program' },
  { key: 'affiliate.community.enabled', value: true, type: 'boolean', category: 'affiliate', description: 'Allow self-serve affiliate signup' },
  { key: 'affiliate.community.commissionRateBps', value: 1500, type: 'bps', category: 'affiliate', description: 'Default community commission (15%)' },
  { key: 'affiliate.community.cookieDays', value: 30, type: 'number', category: 'affiliate', description: 'Community cookie duration' },
  { key: 'affiliate.influencer.enabled', value: true, type: 'boolean', category: 'affiliate', description: 'Allow influencer applications' },
  { key: 'affiliate.influencer.defaultCommissionRateBps', value: 2500, type: 'bps', category: 'affiliate', description: 'Default influencer commission (25%)' },
  { key: 'affiliate.influencer.cookieDays', value: 60, type: 'number', category: 'affiliate', description: 'Influencer cookie duration' },
  { key: 'affiliate.commissionDurationMonths', value: 12, type: 'number', category: 'affiliate', description: 'How long commissions last' },
  { key: 'affiliate.holdDays', value: 30, type: 'number', category: 'affiliate', description: 'Hold period before payable' },
  { key: 'affiliate.minPayoutCents', value: 2500, type: 'cents', category: 'affiliate', description: 'Minimum payout threshold ($25)' },
  { key: 'affiliate.maxPromoDiscountBps', value: 2000, type: 'bps', category: 'affiliate', description: 'Max community promo discount (20%)' },
  { key: 'affiliate.maxInfluencerDiscountBps', value: 5000, type: 'bps', category: 'affiliate', description: 'Max influencer promo discount (50%)' },
  { key: 'affiliate.community.maxPromoCodeDurationMonths', value: 3, type: 'number', category: 'affiliate', description: 'Community max promo code duration (months)' },
  { key: 'affiliate.influencer.maxPromoCodeDurationMonths', value: 6, type: 'number', category: 'affiliate', description: 'Influencer max promo code duration (months)' },
  { key: 'affiliate.community.maxActivePromoCodes', value: 3, type: 'number', category: 'affiliate', description: 'Community max active promo codes' },
  { key: 'affiliate.influencer.maxActivePromoCodes', value: 10, type: 'number', category: 'affiliate', description: 'Influencer max active promo codes' },
  { key: 'affiliate.community.maxFixedPromoDiscountCents', value: 5000, type: 'cents', category: 'affiliate', description: 'Community max fixed promo discount (cents)' },
  { key: 'affiliate.influencer.maxFixedPromoDiscountCents', value: 10000, type: 'cents', category: 'affiliate', description: 'Influencer max fixed promo discount (cents)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // AFFILIATE FRAUD DETECTION (6 keys — G3.5)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'affiliate.fraud.enabled', value: true, type: 'boolean', category: 'affiliate', description: 'Master switch for automated affiliate fraud detection' },
  { key: 'affiliate.fraud.botClickThreshold', value: 100, type: 'number', category: 'affiliate', description: 'Clicks with zero signups in rolling window that triggers bot flag' },
  { key: 'affiliate.fraud.botWindowHours', value: 24, type: 'number', category: 'affiliate', description: 'Rolling window hours for bot traffic detection' },
  { key: 'affiliate.fraud.rapidChurnThreshold', value: 3, type: 'number', category: 'affiliate', description: 'Number of rapid churns before flagging affiliate' },
  { key: 'affiliate.fraud.rapidChurnWindowHours', value: 48, type: 'number', category: 'affiliate', description: 'Hours after conversion to count as rapid churn' },
  { key: 'affiliate.fraud.geoClusterThreshold', value: 50, type: 'number', category: 'affiliate', description: 'Clicks from same /24 subnet in window that triggers geo anomaly' },
  { key: 'affiliate.fraud.suspensionDays', value: 30, type: 'number', category: 'affiliate', description: 'Days a fraud-suspended affiliate is automatically suspended for (strike 2)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATOR AFFILIATE LISTING LINKS (6 keys — G3.6)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'affiliate.listingLinkEnabled', value: true, type: 'boolean', category: 'affiliate', description: 'Allow affiliates to generate links to individual listings' },
  { key: 'affiliate.listingCommissionBps', value: 300, type: 'bps', category: 'affiliate', description: 'Default listing link commission rate (3% = 300 bps)' },
  { key: 'affiliate.listingCommissionMinBps', value: 200, type: 'bps', category: 'affiliate', description: 'Minimum custom commission rate sellers can set (2%)' },
  { key: 'affiliate.listingCommissionMaxBps', value: 1000, type: 'bps', category: 'affiliate', description: 'Maximum custom commission rate sellers can set (10%)' },
  { key: 'affiliate.listingAttributionWindowDays', value: 7, type: 'number', category: 'affiliate', description: 'Cookie duration for listing link attribution (days)' },
  { key: 'affiliate.sellerOptInDefault', value: true, type: 'boolean', category: 'affiliate', description: 'Whether new sellers default to allowing affiliate commissions' },
  { key: 'affiliate.clickRateLimitPerMinute', value: 30, type: 'number', category: 'affiliate', description: 'Max listing-click API calls per IP per minute' },
  { key: 'affiliate.clickRateWindowMs', value: 60000, type: 'number', category: 'affiliate', description: 'Rate limit sliding window in milliseconds' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIALS (12 keys)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'trials.lister.enabled', value: true, type: 'boolean', category: 'trials', description: 'Enable crosslister free trials' },
  { key: 'trials.lister.durationDays', value: 14, type: 'number', category: 'trials', description: 'Crosslister trial duration' },
  { key: 'trials.lister.tier', value: 'LITE', type: 'string', category: 'trials', description: 'Tier granted during crosslister trial' },
  { key: 'trials.store.enabled', value: true, type: 'boolean', category: 'trials', description: 'Enable store free trials' },
  { key: 'trials.store.durationDays', value: 7, type: 'number', category: 'trials', description: 'Store trial duration' },
  { key: 'trials.store.tier', value: 'STARTER', type: 'string', category: 'trials', description: 'Tier granted during store trial' },
  { key: 'trials.automation.enabled', value: true, type: 'boolean', category: 'trials', description: 'Enable automation trial' },
  { key: 'trials.automation.durationDays', value: 14, type: 'number', category: 'trials', description: 'Automation trial duration' },
  { key: 'trials.finance.enabled', value: true, type: 'boolean', category: 'trials', description: 'Enable finance trial' },
  { key: 'trials.finance.durationDays', value: 14, type: 'number', category: 'trials', description: 'Finance trial duration' },
  { key: 'trials.finance.tier', value: 'PRO', type: 'string', category: 'trials', description: 'Finance tier during trial' },
  { key: 'trials.maxExtensionDays', value: 14, type: 'number', category: 'trials', description: 'Max admin trial extension' },
];
