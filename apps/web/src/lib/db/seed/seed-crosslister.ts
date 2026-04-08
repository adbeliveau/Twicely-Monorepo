/**
 * Seed crosslister platform settings, channel category mappings, and policy rules.
 * Source: Lister Canonical Sections 7.3, 8.3, 27.1, 27.2; Feature Lock-in Section 46
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting, channelCategoryMapping, channelPolicyRule } from '@twicely/db/schema';
import { CATEGORY_IDS } from './seed-categories';

// All crosslister platform settings
const CROSSLISTER_SETTINGS = [
  // Feature flags — eBay (enabled at launch)
  { key: 'crosslister.ebay.importEnabled', value: true, type: 'boolean', description: 'eBay import enabled' },
  { key: 'crosslister.ebay.crosslistEnabled', value: true, type: 'boolean', description: 'eBay crosslist enabled' },
  { key: 'crosslister.ebay.automationEnabled', value: true, type: 'boolean', description: 'eBay automation enabled' },
  // Feature flags — Poshmark (enabled at launch)
  { key: 'crosslister.poshmark.importEnabled', value: true, type: 'boolean', description: 'Poshmark import enabled' },
  { key: 'crosslister.poshmark.crosslistEnabled', value: true, type: 'boolean', description: 'Poshmark crosslist enabled' },
  { key: 'crosslister.poshmark.automationEnabled', value: true, type: 'boolean', description: 'Poshmark automation enabled' },
  // Feature flags — Mercari (enabled at launch)
  { key: 'crosslister.mercari.importEnabled', value: true, type: 'boolean', description: 'Mercari import enabled' },
  { key: 'crosslister.mercari.crosslistEnabled', value: true, type: 'boolean', description: 'Mercari crosslist enabled' },
  { key: 'crosslister.mercari.automationEnabled', value: true, type: 'boolean', description: 'Mercari automation enabled' },
  // Feature flags — Depop (disabled)
  { key: 'crosslister.depop.importEnabled', value: false, type: 'boolean', description: 'Depop import enabled' },
  { key: 'crosslister.depop.crosslistEnabled', value: false, type: 'boolean', description: 'Depop crosslist enabled' },
  { key: 'crosslister.depop.automationEnabled', value: false, type: 'boolean', description: 'Depop automation enabled' },
  // Feature flags — Etsy (disabled)
  { key: 'crosslister.etsy.importEnabled', value: false, type: 'boolean', description: 'Etsy import enabled' },
  { key: 'crosslister.etsy.crosslistEnabled', value: false, type: 'boolean', description: 'Etsy crosslist enabled' },
  { key: 'crosslister.etsy.automationEnabled', value: false, type: 'boolean', description: 'Etsy automation enabled' },
  // Feature flags — Facebook Marketplace (disabled)
  { key: 'crosslister.fbMarketplace.importEnabled', value: false, type: 'boolean', description: 'FB Marketplace import enabled' },
  { key: 'crosslister.fbMarketplace.crosslistEnabled', value: false, type: 'boolean', description: 'FB Marketplace crosslist enabled' },
  { key: 'crosslister.fbMarketplace.automationEnabled', value: false, type: 'boolean', description: 'FB Marketplace automation enabled' },
  // Feature flags — Grailed (disabled)
  { key: 'crosslister.grailed.importEnabled', value: false, type: 'boolean', description: 'Grailed import enabled' },
  { key: 'crosslister.grailed.crosslistEnabled', value: false, type: 'boolean', description: 'Grailed crosslist enabled' },
  { key: 'crosslister.grailed.automationEnabled', value: false, type: 'boolean', description: 'Grailed automation enabled' },
  // Feature flags — The RealReal (disabled)
  { key: 'crosslister.therealreal.importEnabled', value: false, type: 'boolean', description: 'The RealReal import enabled' },
  { key: 'crosslister.therealreal.crosslistEnabled', value: false, type: 'boolean', description: 'The RealReal crosslist enabled' },
  { key: 'crosslister.therealreal.automationEnabled', value: false, type: 'boolean', description: 'The RealReal automation enabled' },
  // Rate limits per seller per hour (Source: Lister Canonical Section 8.3)
  { key: 'crosslister.rateLimit.ebay.callsPerHourPerSeller', value: 200, type: 'number', description: 'eBay API calls per hour per seller' },
  { key: 'crosslister.rateLimit.poshmark.callsPerHourPerSeller', value: 60, type: 'number', description: 'Poshmark calls per hour per seller' },
  { key: 'crosslister.rateLimit.mercari.callsPerHourPerSeller', value: 150, type: 'number', description: 'Mercari calls per hour per seller' },
  { key: 'crosslister.rateLimit.depop.callsPerHourPerSeller', value: 150, type: 'number', description: 'Depop calls per hour per seller' },
  { key: 'crosslister.rateLimit.etsy.callsPerHourPerSeller', value: 200, type: 'number', description: 'Etsy calls per hour per seller' },
  { key: 'crosslister.rateLimit.fbMarketplace.callsPerHourPerSeller', value: 100, type: 'number', description: 'FB Marketplace calls per hour per seller' },
  { key: 'crosslister.rateLimit.grailed.callsPerHourPerSeller', value: 150, type: 'number', description: 'Grailed calls per hour per seller' },
  { key: 'crosslister.rateLimit.therealreal.callsPerHourPerSeller', value: 60, type: 'number', description: 'The RealReal calls per hour per seller' },
  // Fairness quota (Source: Lister Canonical Section 8.1)
  { key: 'crosslister.fairness.maxJobsPerSellerPerMinute', value: 10, type: 'number', description: 'Max crosslister jobs dispatched per seller per minute (fairness quota)' },
  // Tier weight multipliers (Source: Lister Canonical Section 8.1)
  { key: 'crosslister.tierWeight.none', value: 0.5, type: 'number', description: 'Quota multiplier for NONE tier' },
  { key: 'crosslister.tierWeight.free', value: 1.0, type: 'number', description: 'Quota multiplier for FREE tier' },
  { key: 'crosslister.tierWeight.lite', value: 1.5, type: 'number', description: 'Quota multiplier for LITE tier' },
  { key: 'crosslister.tierWeight.pro', value: 3.0, type: 'number', description: 'Quota multiplier for PRO tier' },
  // Circuit breaker thresholds (Source: Lister Canonical Section 8.4)
  { key: 'crosslister.circuitBreaker.failureThreshold', value: 5, type: 'number', description: 'Consecutive failures before circuit opens' },
  { key: 'crosslister.circuitBreaker.recoveryWindowMs', value: 300000, type: 'number', description: 'Ms before OPEN circuit transitions to HALF_OPEN (5 min)' },
  { key: 'crosslister.circuitBreaker.halfOpenSuccesses', value: 2, type: 'number', description: 'Successes in HALF_OPEN before circuit closes' },
  // Publish limits by ListerTier (Source: Lister Canonical Section 7.3)
  { key: 'crosslister.publishLimit.free', value: 5, type: 'number', description: 'DEPRECATED — use crosslister.publishes.FREE. Updated to 5 (was 25) per Decision #105 — FREE is a 5-publish/6-month teaser, not a 25/month allowance.' },
  { key: 'crosslister.publishLimit.lite', value: 200, type: 'number', description: 'Monthly publish limit for LITE ListerTier (DEPRECATED — use crosslister.publishes.LITE)' },
  { key: 'crosslister.publishLimit.pro', value: 2000, type: 'number', description: 'Monthly publish limit for PRO ListerTier (DEPRECATED — use crosslister.publishes.PRO)' },
  { key: 'crosslister.rolloverMaxMultiplier', value: 3, type: 'number', description: 'Max rollover multiplier (3x monthly limit)' },
  { key: 'crosslister.rolloverExpiryDays', value: 60, type: 'number', description: 'Unused publish credits expire after N days' },
  // UX settings (Source: Feature Lock-in Section 46)
  { key: 'crosslisterUx.showLockedPreview', value: true, type: 'boolean', description: 'Show channel preview for locked/upsell tiers' },
  { key: 'crosslisterUx.sidebarWidgetEnabled', value: true, type: 'boolean', description: 'Show crosslister widget in seller sidebar' },
  { key: 'crosslisterUx.pushTrackingEnabled', value: true, type: 'boolean', description: 'Enable push notification for crosslist events' },
  { key: 'crosslisterUx.profitCalculatorEnabled', value: true, type: 'boolean', description: 'Show profit calculator in crosslister UI' },
  // Import settings
  { key: 'crosslister.import.batchSize', value: 50, type: 'number', description: 'Number of listings fetched per import batch page' },
  { key: 'crosslister.import.maxConcurrentBatches', value: 3, type: 'number', description: 'Max parallel import batch jobs per seller' },
  // Platform fee rates for off-platform sales (F5-S1 — informational only, Decision #31)
  // Source: F5-S1 install prompt §1.5
  { key: 'crosslister.fees.ebay.rateBps', value: 1290, type: 'number', description: 'eBay effective fee rate in bps (12.9% = transaction fee + payment processing)' },
  { key: 'crosslister.fees.poshmark.rateBps', value: 2000, type: 'number', description: 'Poshmark fee rate in bps (20% flat)' },
  { key: 'crosslister.fees.mercari.rateBps', value: 1000, type: 'number', description: 'Mercari fee rate in bps (10%)' },
  { key: 'crosslister.fees.depop.rateBps', value: 1000, type: 'number', description: 'Depop fee rate in bps (10%)' },
  { key: 'crosslister.fees.facebook.rateBps', value: 500, type: 'number', description: 'Facebook Marketplace fee rate in bps (5%)' },
  { key: 'crosslister.fees.etsy.rateBps', value: 1300, type: 'number', description: 'Etsy effective fee rate in bps (13% = listing + transaction + payment)' },
  { key: 'crosslister.fees.grailed.rateBps', value: 1000, type: 'number', description: 'Grailed fee rate in bps (10%)' },
  { key: 'crosslister.fees.therealreal.rateBps', value: 2000, type: 'number', description: 'The RealReal fee rate in bps (20%)' },
  // eBay OAuth credentials (F1.1 — values populated by admin before launch)
  { key: 'crosslister.ebay.clientId', value: '', type: 'string', description: 'eBay app client ID for OAuth' },
  { key: 'crosslister.ebay.clientSecret', value: '', type: 'string', description: 'eBay app client secret for OAuth' },
  { key: 'crosslister.ebay.redirectUri', value: 'https://twicely.co/api/crosslister/ebay/callback', type: 'string', description: 'eBay OAuth redirect URI' },
  { key: 'crosslister.ebay.environment', value: 'PRODUCTION', type: 'string', description: 'eBay API environment: PRODUCTION or SANDBOX' },
  // Poshmark API config (F2 — session-based, no OAuth credentials needed)
  { key: 'crosslister.poshmark.apiBase', value: 'https://poshmark.com/api', type: 'string', description: 'Poshmark internal API base URL' },
  { key: 'crosslister.poshmark.userAgent', value: 'Poshmark/8.0 (iPhone; iOS 17.0)', type: 'string', description: 'User-Agent header for Poshmark API requests' },
  // Mercari OAuth credentials (F2 — values populated by admin before launch)
  { key: 'crosslister.mercari.clientId', value: '', type: 'string', description: 'Mercari app client ID for OAuth' },
  { key: 'crosslister.mercari.clientSecret', value: '', type: 'string', description: 'Mercari app client secret for OAuth' },
  { key: 'crosslister.mercari.redirectUri', value: 'https://twicely.co/api/crosslister/mercari/callback', type: 'string', description: 'Mercari OAuth redirect URI' },
  { key: 'crosslister.mercari.environment', value: 'PRODUCTION', type: 'string', description: 'Mercari API environment' },
  // Etsy OAuth credentials (F3 — values populated by admin before launch)
  { key: 'crosslister.etsy.clientId', value: '', type: 'string', description: 'Etsy app client ID (keystring) for OAuth' },
  { key: 'crosslister.etsy.clientSecret', value: '', type: 'string', description: 'Etsy app client secret for OAuth' },
  { key: 'crosslister.etsy.redirectUri', value: 'https://twicely.co/api/crosslister/etsy/callback', type: 'string', description: 'Etsy OAuth redirect URI' },
  // Facebook Marketplace OAuth credentials (F3 — values populated by admin before launch)
  { key: 'crosslister.fbMarketplace.clientId', value: '', type: 'string', description: 'Facebook app ID for Commerce API OAuth' },
  { key: 'crosslister.fbMarketplace.clientSecret', value: '', type: 'string', description: 'Facebook app secret for Commerce API OAuth' },
  { key: 'crosslister.fbMarketplace.redirectUri', value: 'https://twicely.co/api/crosslister/fb-marketplace/callback', type: 'string', description: 'Facebook Marketplace OAuth redirect URI' },
  // Grailed OAuth credentials (F3 — values populated by admin before launch)
  { key: 'crosslister.grailed.clientId', value: '', type: 'string', description: 'Grailed app client ID for OAuth' },
  { key: 'crosslister.grailed.clientSecret', value: '', type: 'string', description: 'Grailed app client secret for OAuth' },
  { key: 'crosslister.grailed.redirectUri', value: 'https://twicely.co/api/crosslister/grailed/callback', type: 'string', description: 'Grailed OAuth redirect URI' },
  // Depop OAuth credentials (F3 — values populated by admin before launch)
  { key: 'crosslister.depop.clientId', value: '', type: 'string', description: 'Depop app client ID for OAuth' },
  { key: 'crosslister.depop.clientSecret', value: '', type: 'string', description: 'Depop app client secret for OAuth' },
  { key: 'crosslister.depop.redirectUri', value: 'https://twicely.co/api/crosslister/depop/callback', type: 'string', description: 'Depop OAuth redirect URI' },
  // The RealReal session config (F3 — session-based, no OAuth credentials needed)
  { key: 'crosslister.therealreal.apiBase', value: 'https://www.therealreal.com/api/v1', type: 'string', description: 'The RealReal internal API base URL' },
  { key: 'crosslister.therealreal.userAgent', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', type: 'string', description: 'User-Agent header for The RealReal API requests' },
  // Feature flags — Whatnot (disabled at launch — pending API access approval)
  { key: 'crosslister.whatnot.importEnabled', value: false, type: 'boolean', description: 'Whatnot import enabled' },
  { key: 'crosslister.whatnot.crosslistEnabled', value: false, type: 'boolean', description: 'Whatnot crosslist enabled' },
  { key: 'crosslister.whatnot.automationEnabled', value: false, type: 'boolean', description: 'Whatnot automation enabled' },
  // Whatnot OAuth credentials (H2.1 — values populated by admin when API access is approved)
  { key: 'crosslister.whatnot.clientId', value: '', type: 'string', description: 'Whatnot app client ID for OAuth' },
  { key: 'crosslister.whatnot.clientSecret', value: '', type: 'string', description: 'Whatnot app client secret for OAuth' },
  { key: 'crosslister.whatnot.redirectUri', value: 'https://twicely.co/api/crosslister/whatnot/callback', type: 'string', description: 'Whatnot OAuth redirect URI' },
  { key: 'crosslister.whatnot.environment', value: 'PRODUCTION', type: 'string', description: 'Whatnot API environment (PRODUCTION or STAGING)' },
  // Whatnot rate limits
  { key: 'crosslister.whatnot.rateLimitPerMinute', value: 60, type: 'number', description: 'Whatnot API requests per minute' },
  { key: 'crosslister.whatnot.rateLimitPerDay', value: 5000, type: 'number', description: 'Whatnot API requests per day' },
  // Whatnot webhook secret (H2.3 — value populated by admin when webhook endpoint is registered with Whatnot)
  { key: 'crosslister.whatnot.webhookSecret', value: '', type: 'string', description: 'Whatnot webhook HMAC signing secret' },
  // Whatnot fee rate (H2.3 — informational only, for off-platform P&L)
  { key: 'crosslister.fees.whatnot.rateBps', value: 1000, type: 'number', description: 'Whatnot fee rate in bps (10% = 1000)' },
  // Whatnot OAuth scopes
  { key: 'crosslister.whatnot.scopes', value: 'read:inventory write:inventory read:orders', type: 'string', description: 'Whatnot OAuth scopes to request' },
  // Feature flags -- Shopify (disabled at launch -- pending Shopify Partner app approval)
  { key: 'crosslister.shopify.importEnabled', value: false, type: 'boolean', description: 'Shopify import enabled' },
  { key: 'crosslister.shopify.crosslistEnabled', value: false, type: 'boolean', description: 'Shopify crosslist enabled' },
  { key: 'crosslister.shopify.automationEnabled', value: false, type: 'boolean', description: 'Shopify automation enabled' },
  // Shopify OAuth credentials (H3.1 -- values populated by admin when Shopify Partner app is created)
  { key: 'crosslister.shopify.clientId', value: '', type: 'string', description: 'Shopify app API key' },
  { key: 'crosslister.shopify.clientSecret', value: '', type: 'string', description: 'Shopify app API secret key' },
  { key: 'crosslister.shopify.redirectUri', value: 'https://twicely.co/api/crosslister/shopify/callback', type: 'string', description: 'Shopify OAuth redirect URI' },
  // Shopify API version
  { key: 'crosslister.shopify.apiVersion', value: '2024-01', type: 'string', description: 'Shopify Admin API version' },
  // Shopify OAuth scopes
  { key: 'crosslister.shopify.scopes', value: 'read_products,write_products,read_inventory,write_inventory,read_orders', type: 'string', description: 'Shopify OAuth scopes to request (comma-separated)' },
  // Shopify rate limits (Shopify REST API: 2 requests/second per store by default, 40 request bucket)
  { key: 'crosslister.shopify.rateLimitPerMinute', value: 120, type: 'number', description: 'Shopify API requests per minute per store' },
  { key: 'crosslister.shopify.rateLimitPerDay', value: 10000, type: 'number', description: 'Shopify API requests per day per store' },
  // Shopify fee rate (informational only, for off-platform P&L)
  { key: 'crosslister.fees.shopify.rateBps', value: 290, type: 'number', description: 'Shopify Payments processing fee in bps (2.9% + 30c, simplified to 2.9%)' },
  // Shopify per-seller rate limit
  { key: 'crosslister.rateLimit.shopify.callsPerHourPerSeller', value: 200, type: 'number', description: 'Shopify API calls per hour per seller' },
  // Shopify webhook settings (H3.4 — bidirectional sync)
  { key: 'crosslister.shopify.webhookUrl', value: 'https://twicely.co/api/crosslister/shopify/webhook', type: 'string', description: 'Shopify webhook callback URL' },
  { key: 'crosslister.shopify.webhookTopics', value: 'products/create,products/update,products/delete,orders/create,orders/paid,app/uninstalled', type: 'string', description: 'Shopify webhook topics to register (comma-separated)' },
  { key: 'crosslister.shopify.syncEnabled', value: true, type: 'boolean', description: 'Enable Shopify bidirectional sync (webhook receiving)' },
  // Feature flags -- Vestiaire Collective (disabled at launch)
  { key: 'crosslister.vestiaire.importEnabled', value: false, type: 'boolean', description: 'Vestiaire Collective import enabled' },
  { key: 'crosslister.vestiaire.crosslistEnabled', value: false, type: 'boolean', description: 'Vestiaire Collective crosslist enabled' },
  { key: 'crosslister.vestiaire.automationEnabled', value: false, type: 'boolean', description: 'Vestiaire Collective automation enabled' },
  // Rate limits
  { key: 'crosslister.rateLimit.vestiaire.callsPerHourPerSeller', value: 60, type: 'number', description: 'Vestiaire calls per hour per seller' },
  // Platform fee rate (informational, for P&L tracking)
  { key: 'crosslister.fees.vestiaire.rateBps', value: 1500, type: 'number', description: 'Vestiaire Collective fee rate in bps (15%)' },
  // Session config (no OAuth credentials -- session-based)
  { key: 'crosslister.vestiaire.apiBase', value: 'https://www.vestiairecollective.com/api', type: 'string', description: 'Vestiaire Collective API base URL' },
  { key: 'crosslister.vestiaire.userAgent', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', type: 'string', description: 'User-Agent header for Vestiaire Collective requests' },
] as const;

/**
 * Seed crosslister platform settings, channel category mappings, and policy rules.
 */
export async function seedCrosslister(db: PostgresJsDatabase): Promise<void> {
  // 1. Platform settings
  for (const setting of CROSSLISTER_SETTINGS) {
    await db
      .insert(platformSetting)
      .values({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: 'crosslister',
        description: setting.description,
      })
      .onConflictDoNothing();
  }

  // 2. Channel category mappings — 3 platforms, top-level Twicely categories
  // Demonstrates the mapping pattern; production mappings are a data migration.
  await db
    .insert(channelCategoryMapping)
    .values([
      // eBay mappings
      {
        id: 'seed-ccm-ebay-apparel',
        channel: 'EBAY',
        twicelyCategoryId: CATEGORY_IDS.apparel,
        externalCategoryId: '11450',
        externalCategoryName: 'Clothing, Shoes & Accessories',
        confidence: 0.95,
        isVerified: true,
      },
      {
        id: 'seed-ccm-ebay-electronics',
        channel: 'EBAY',
        twicelyCategoryId: CATEGORY_IDS.electronics,
        externalCategoryId: '58058',
        externalCategoryName: 'Consumer Electronics',
        confidence: 0.95,
        isVerified: true,
      },
      {
        id: 'seed-ccm-ebay-collectibles',
        channel: 'EBAY',
        twicelyCategoryId: CATEGORY_IDS.collectibles,
        externalCategoryId: '1',
        externalCategoryName: 'Collectibles',
        confidence: 0.9,
        isVerified: true,
      },
      // Poshmark mappings
      {
        id: 'seed-ccm-poshmark-womens',
        channel: 'POSHMARK',
        twicelyCategoryId: CATEGORY_IDS.womens,
        externalCategoryId: 'category_women',
        externalCategoryName: "Women's Clothing",
        confidence: 0.95,
        isVerified: true,
      },
      {
        id: 'seed-ccm-poshmark-mens',
        channel: 'POSHMARK',
        twicelyCategoryId: CATEGORY_IDS.mens,
        externalCategoryId: 'category_men',
        externalCategoryName: "Men's Clothing",
        confidence: 0.95,
        isVerified: true,
      },
      {
        id: 'seed-ccm-poshmark-shoes',
        channel: 'POSHMARK',
        twicelyCategoryId: CATEGORY_IDS.shoes,
        externalCategoryId: 'category_shoes',
        externalCategoryName: 'Shoes',
        confidence: 0.95,
        isVerified: true,
      },
      // Mercari mappings
      {
        id: 'seed-ccm-mercari-electronics',
        channel: 'MERCARI',
        twicelyCategoryId: CATEGORY_IDS.electronics,
        externalCategoryId: 'mc_electronics',
        externalCategoryName: 'Electronics',
        confidence: 0.9,
        isVerified: true,
      },
      {
        id: 'seed-ccm-mercari-apparel',
        channel: 'MERCARI',
        twicelyCategoryId: CATEGORY_IDS.apparel,
        externalCategoryId: 'mc_clothing',
        externalCategoryName: 'Clothing & Shoes',
        confidence: 0.9,
        isVerified: true,
      },
      {
        id: 'seed-ccm-mercari-home',
        channel: 'MERCARI',
        twicelyCategoryId: CATEGORY_IDS.home,
        externalCategoryId: 'mc_home',
        externalCategoryName: 'Home & Living',
        confidence: 0.9,
        isVerified: true,
      },
    ])
    .onConflictDoNothing();

  // 3. Channel policy rules — 5 rules demonstrating the pattern
  await db
    .insert(channelPolicyRule)
    .values([
      {
        id: 'seed-cpr-ebay-title-length',
        channel: 'EBAY',
        field: 'title',
        constraintJson: { maxLength: 80 },
        guidance: 'eBay titles must be 80 characters or fewer.',
        severity: 'ERROR',
        isActive: true,
      },
      {
        id: 'seed-cpr-poshmark-min-photo',
        channel: 'POSHMARK',
        field: 'images',
        constraintJson: { minCount: 1 },
        guidance: 'Poshmark listings must have at least 1 photo.',
        severity: 'ERROR',
        isActive: true,
      },
      {
        id: 'seed-cpr-ebay-item-specifics',
        channel: 'EBAY',
        field: 'itemSpecifics',
        constraintJson: { required: ['Brand', 'Condition'] },
        guidance: 'eBay requires Brand and Condition item specifics.',
        severity: 'WARN',
        isActive: true,
      },
      {
        id: 'seed-cpr-mercari-no-ext-links',
        channel: 'MERCARI',
        field: 'description',
        constraintJson: { forbidPattern: 'https?://' },
        guidance: 'Mercari prohibits external links in descriptions.',
        severity: 'ERROR',
        isActive: true,
      },
      {
        id: 'seed-cpr-depop-image-max',
        channel: 'DEPOP',
        field: 'images',
        constraintJson: { maxCount: 4 },
        guidance: 'Depop supports a maximum of 4 images per listing.',
        severity: 'ERROR',
        isActive: true,
      },
    ])
    .onConflictDoNothing();
}
