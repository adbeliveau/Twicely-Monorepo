/**
 * v3.2 Platform Settings — Extended Categories
 * Commerce, Fulfillment, Trust, Discovery, Communications, Privacy, Feature Flags
 * Category-adjusted score thresholds are in v32-platform-settings-score-thresholds.ts.
 * Seller Score Engine settings are in v32-platform-settings-score-engine.ts.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';
import { V32_SCORE_ENGINE_SETTINGS } from './v32-platform-settings-score-engine';
import { V32_EXTENDED_SETTINGS_PART2 } from './v32-platform-settings-extended-part2';

export { V32_EXTENDED_SETTINGS_PART2 };

export const V32_EXTENDED_SETTINGS_CORE: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMMERCE — Cart, Offers, Orders, Listings
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.cart.expiryHours', value: 72, type: 'number', category: 'commerce', description: 'Cart items expire after this many hours' },
  { key: 'commerce.cart.maxItems', value: 100, type: 'number', category: 'commerce', description: 'Maximum items allowed in cart' },
  { key: 'commerce.cart.reservationMinutes', value: 15, type: 'number', category: 'commerce', description: 'Hold item in cart before releasing' },
  { key: 'commerce.cart.guestCheckoutEnabled', value: false, type: 'boolean', category: 'commerce', description: 'Allow checkout without account' },
  { key: 'commerce.offer.enabled', value: true, type: 'boolean', category: 'commerce', description: 'Enable Make Offer feature globally' },
  { key: 'commerce.offer.expirationHours', value: 48, type: 'number', category: 'commerce', description: 'Offers expire after X hours' },
  { key: 'commerce.offer.minPercentOfAsking', value: 50, type: 'number', category: 'commerce', description: 'Minimum offer as % of asking price' },
  { key: 'commerce.offer.counterOfferEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Allow sellers to counter buyer offers' },
  { key: 'commerce.offer.maxOffersPerBuyer', value: 3, type: 'number', category: 'commerce', description: 'Max offers per buyer per listing' },
  { key: 'commerce.offer.autoDeclineBelowMin', value: true, type: 'boolean', category: 'commerce', description: 'Auto-reject offers below minimum' },
  { key: 'commerce.offer.maxOffersPerBuyerGlobal', value: 10, type: 'number', category: 'commerce', description: 'Max active offers per buyer across all listings' },
  { key: 'commerce.offer.maxCounterDepth', value: 3, type: 'number', category: 'commerce', description: 'Max counter-offer rounds per negotiation' },
  { key: 'commerce.offer.maxOffersPerListing', value: 3, type: 'number', category: 'commerce', description: 'Max concurrent active offers per listing' },
  { key: 'commerce.offer.watcherExpiryHours', value: 24, type: 'number', category: 'commerce', description: 'Watcher offer expiry in hours' },
  { key: 'commerce.auth.offerThresholdCents', value: 50000, type: 'cents', category: 'commerce', description: 'Require authentication for offers above this amount' },
  { key: 'commerce.auth.buyerFeeCents', value: 1999, type: 'cents', category: 'commerce', description: 'Buyer authentication fee' },
  { key: 'commerce.protection.standardClaimWindowDays', value: 30, type: 'number', category: 'commerce', description: 'Standard buyer protection claim window (days from delivery)' },
  { key: 'commerce.protection.counterfeitClaimWindowDays', value: 60, type: 'number', category: 'commerce', description: 'Counterfeit claim window (days from delivery)' },
  { key: 'bundle.enabled', value: true, type: 'boolean', category: 'commerce', description: 'Enable seller bundle creation' },
  { key: 'bundle.maxPerSeller', value: 50, type: 'number', category: 'commerce', description: 'Maximum bundles per seller' },
  { key: 'bundle.maxDiscountPercent', value: 50, type: 'number', category: 'commerce', description: 'Max discount on bundle vs individual' },
  { key: 'bundle.smartPromptsEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Show bundle suggestions in cart' },
  { key: 'bundle.freeShippingPromptEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Suggest items for free shipping in cart' },
  { key: 'bundle.maxPromptsPerCart', value: 3, type: 'number', category: 'commerce', description: 'Max bundle prompts shown at once' },
  { key: 'commerce.order.autoCompleteAfterDays', value: 3, type: 'number', category: 'commerce', description: 'Days after delivery before order auto-completes (separate from escrow hold)' },
  { key: 'commerce.order.buyerCancelWindowHours', value: 1, type: 'number', category: 'commerce', description: 'Hours buyer can cancel after purchase' },
  { key: 'commerce.order.maxItemsPerOrder', value: 100, type: 'number', category: 'commerce', description: 'Maximum items in single order' },
  { key: 'listing.maxImagesPerListing', value: 24, type: 'number', category: 'commerce', description: 'Maximum photos per listing' },
  { key: 'listing.minTitleLength', value: 10, type: 'number', category: 'commerce', description: 'Minimum characters in listing title' },
  { key: 'listing.maxTitleLength', value: 80, type: 'number', category: 'commerce', description: 'Maximum characters in listing title' },
  { key: 'listing.maxDescriptionLength', value: 5000, type: 'number', category: 'commerce', description: 'Maximum characters in listing description' },
  { key: 'listing.durationDays', value: 90, type: 'number', category: 'commerce', description: 'Default listing duration in days' },
  { key: 'listing.autoRenewEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Allow auto-renew of expired listings' },
  { key: 'commerce.cancel.buyerWindowHours', value: 1, type: 'number', category: 'commerce', description: 'Hours buyer can cancel after purchase' },
  { key: 'commerce.cancel.sellerPenaltyEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Penalize sellers who cancel orders' },
  { key: 'commerce.cancel.autoRefundOnCancel', value: true, type: 'boolean', category: 'commerce', description: 'Automatically refund on cancellation' },
  { key: 'commerce.cancel.sellerCancelAffectsStandards', value: true, type: 'boolean', category: 'commerce', description: 'Seller cancels impact seller standards metrics' },
  { key: 'commerce.condition.requireFlawDescription', value: true, type: 'boolean', category: 'commerce', description: 'Require flaw description for non-new condition items' },
  { key: 'commerce.condition.allowCategorySpecific', value: true, type: 'boolean', category: 'commerce', description: 'Allow category-specific condition labels' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FULFILLMENT — Shipping, Returns, Insurance
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'fulfillment.shipping.defaultHandlingDays', value: 3, type: 'number', category: 'fulfillment', description: 'Default handling time in business days' },
  { key: 'fulfillment.shipping.maxHandlingDays', value: 10, type: 'number', category: 'fulfillment', description: 'Maximum allowed handling time' },
  { key: 'fulfillment.shipping.trackingRequiredAboveCents', value: 5000, type: 'cents', category: 'fulfillment', description: 'Require tracking for orders above this amount' },
  { key: 'fulfillment.shipping.signatureRequiredAboveCents', value: 75000, type: 'cents', category: 'fulfillment', description: 'Require signature for orders above this amount' },
  { key: 'fulfillment.shipping.defaultCarrier', value: 'USPS', type: 'string', category: 'fulfillment', description: 'Default shipping carrier' },
  { key: 'fulfillment.shipping.labelGenerationEnabled', value: true, type: 'boolean', category: 'fulfillment', description: 'Enable shipping label generation via Shippo' },
  { key: 'fulfillment.shipping.labelDiscountPercent', value: 0, type: 'number', category: 'fulfillment', description: 'Discount percentage on shipping label generation (0 = no discount)' },
  { key: 'fulfillment.insurance.autoInsureAboveCents', value: 10000, type: 'cents', category: 'fulfillment', description: 'Auto-insure shipments above this amount ($100)' },
  { key: 'fulfillment.returns.windowDays', value: 30, type: 'number', category: 'fulfillment', description: 'Default return window in days' },
  { key: 'fulfillment.returns.restockingFeeBps', value: 0, type: 'bps', category: 'fulfillment', description: 'Restocking fee in basis points' },
  { key: 'commerce.returns.restockingFeePercent', value: 0.10, type: 'number', category: 'fulfillment', description: 'Restocking fee as a decimal fraction (e.g. 0.10 = 10%) for buyer-remorse returns' },
  { key: 'commerce.returns.restockingFeeMaxCents', value: 5000, type: 'cents', category: 'fulfillment', description: 'Maximum restocking fee in cents ($50)' },
  { key: 'commerce.returns.restockingFeeMinCents', value: 100, type: 'cents', category: 'fulfillment', description: 'Minimum restocking fee in cents ($1)' },
  { key: 'commerce.returns.tfRefundRemorsePercent', value: 0.50, type: 'number', category: 'fulfillment', description: 'Fraction of TF refunded to seller on buyer-remorse returns (e.g. 0.50 = 50%)' },
  { key: 'payout.newSellerHoldDays', value: 7, type: 'number', category: 'fulfillment', description: 'Extra hold for sellers with < 5 completed orders (days)' },
  { key: 'payout.highRiskHoldEnabled', value: true, type: 'boolean', category: 'fulfillment', description: 'Enable holds for high-risk transactions' },
  { key: 'payout.onDemandCooldownHours', value: 24, type: 'number', category: 'payout', description: 'Cooldown hours between seller-initiated on-demand payout requests' },
  { key: 'payout.newSellerHoldThresholdCents', value: 50000, type: 'cents', category: 'payout', description: 'GMV threshold ($500) above which new seller holds apply' },
  { key: 'fulfillment.insurance.maxCoverageCents', value: 500000, type: 'cents', category: 'fulfillment', description: 'Maximum insurance coverage per shipment ($5,000)' },
  { key: 'fulfillment.shipping.lateThresholdDays', value: 1, type: 'number', category: 'fulfillment', description: 'Days past handling time before shipment is marked late' },
  { key: 'fulfillment.shipping.insuranceRatePercent', value: 1, type: 'number', category: 'fulfillment', description: 'Insurance cost as percentage of insured value (default 1%)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEAL BADGES — Market index / deal badge constants
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'dealBadge.minSampleSize', value: 20, type: 'number', category: 'discovery', description: 'Min comparable listings for market intelligence' },
  { key: 'dealBadge.fastSellerDays', value: 7, type: 'number', category: 'discovery', description: 'Max avg days to sell for FAST_SELLER badge' },
  { key: 'dealBadge.greatPricePercentile', value: 0.20, type: 'number', category: 'discovery', description: 'Price percentile for GREAT_PRICE badge (bottom 20%)' },
  { key: 'dealBadge.priceDropWindowDays', value: 7, type: 'number', category: 'discovery', description: 'Days window for PRICE_DROP badge' },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOVERY — Search, promotions, price alerts, market index
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'discovery.search.titleWeight', value: 10, type: 'number', category: 'discovery', description: 'Weight for title matches in search ranking' },
  { key: 'discovery.search.descriptionWeight', value: 3, type: 'number', category: 'discovery', description: 'Weight for description matches in search' },
  { key: 'discovery.search.trustMultiplierEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Boost trusted sellers in search results' },
  { key: 'discovery.search.freshnessBoostEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Boost recently listed items in search' },
  { key: 'discovery.search.defaultPageSize', value: 24, type: 'number', category: 'discovery', description: 'Default search results per page' },
  { key: 'discovery.promo.boostEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Enable promoted listings in search' },
  { key: 'discovery.promo.maxBoostMultiplier', value: 3, type: 'number', category: 'discovery', description: 'Maximum ranking boost for promoted listings' },
  { key: 'discovery.priceAlert.enabled', value: true, type: 'boolean', category: 'discovery', description: 'Enable price drop alerts' },
  { key: 'discovery.priceAlert.maxPerUser', value: 50, type: 'number', category: 'discovery', description: 'Maximum price alerts per user' },
  { key: 'discovery.marketIndex.enabled', value: true, type: 'boolean', category: 'discovery', description: 'Compute market price indexes' },
  { key: 'discovery.marketIndex.dealBadgesEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Show Great Deal badges on listings' },
  { key: 'discovery.personalization.purchaseWeight', value: 2, type: 'number', category: 'discovery', description: 'Weight multiplier for purchase-based interest signals' },
  { key: 'discovery.personalization.purchaseExpiryDays', value: 90, type: 'number', category: 'discovery', description: 'Days before a purchase interest signal expires' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATIONS — Messaging channel settings (email/push/sms/digest in seed-comms-settings.ts)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'comms.messaging.enabled', value: true, type: 'boolean', category: 'comms', description: 'Enable buyer-seller direct messaging' },
  { key: 'comms.messaging.rateLimitPerHour', value: 30, type: 'number', category: 'comms', description: 'Max messages per user per hour' },
  { key: 'comms.messaging.moderationEnabled', value: true, type: 'boolean', category: 'comms', description: 'Enable message content moderation' },
  { key: 'comms.messaging.attachmentMaxBytes', value: 10_485_760, type: 'number', category: 'comms', description: 'Message attachment max file size (bytes)' },
  { key: 'comms.messaging.bannedKeywords', value: [], type: 'array', category: 'comms', description: 'Banned keyword list for message moderation (managed via /cfg/messaging/keywords)' },
  { key: 'comms.messaging.autoResponseEnabled', value: false, type: 'boolean', category: 'comms', description: 'Enable auto-response for buyer-seller messages' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY — Data retention, GDPR
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'privacy.retention.messageDays', value: 730, type: 'number', category: 'privacy', description: 'Keep messages for this many days (2 years)' },
  { key: 'privacy.retention.searchLogDays', value: 90, type: 'number', category: 'privacy', description: 'Keep search logs for this many days' },
  { key: 'privacy.retention.auditLogDays', value: 2555, type: 'number', category: 'privacy', description: 'Keep audit logs for compliance (7 years)' },
  { key: 'privacy.gdpr.dataExportEnabled', value: true, type: 'boolean', category: 'privacy', description: 'Allow users to export their data' },
  { key: 'privacy.gdpr.deletionGracePeriodDays', value: 30, type: 'number', category: 'privacy', description: 'Days before permanent deletion after request' },
  { key: 'privacy.gdpr.anonymizeOnDeletion', value: true, type: 'boolean', category: 'privacy', description: 'Anonymize vs hard delete user data' },
  { key: 'privacy.gdpr.cookieConsentRequired', value: true, type: 'boolean', category: 'privacy', description: 'Require cookie consent banner' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL FEED — G3.8
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'social.feed.followedSellerListingLimit', value: 20, type: 'number', category: 'social', description: 'Max followed seller listings shown in feed' },
  { key: 'social.feed.interestListingLimit', value: 40, type: 'number', category: 'social', description: 'Max interest-matched listings in feed' },
  { key: 'social.feed.enabled', value: true, type: 'boolean', category: 'social', description: 'Master switch for feed feature' },

  // ═══════════════════════════════════════════════════════════════════════════
  // VACATION MODE — G3.7
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'vacation.maxPauseDays', value: 30, type: 'number', category: 'vacation', description: 'Maximum days for Pause Sales mode' },
  { key: 'vacation.maxAllowSalesDays', value: 15, type: 'number', category: 'vacation', description: 'Maximum days for Allow Sales mode' },
  { key: 'vacation.autoDeclinePendingOffers', value: true, type: 'boolean', category: 'vacation', description: 'Auto-decline pending offers when vacation starts' },
  { key: 'vacation.requireBuyerAcknowledgment', value: true, type: 'boolean', category: 'vacation', description: 'Require buyer to acknowledge delayed shipping in Allow Sales mode' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLORE PAGE — G3.9
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'discovery.explore.trendingLimit', value: 24, type: 'number', category: 'discovery', description: 'Max trending listings shown on Explore page' },
  { key: 'discovery.explore.risingSellerLimit', value: 8, type: 'number', category: 'discovery', description: 'Max rising sellers shown on Explore page' },
  { key: 'discovery.explore.trendingWindowDays', value: 7, type: 'number', category: 'discovery', description: 'Number of days to compute trending velocity over' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAX & COMPLIANCE — G5
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'tax.facilitatorEnabled', value: true, type: 'boolean', category: 'tax', description: 'Enable marketplace facilitator tax collection' },
  { key: 'tax.1099kThresholdCents', value: 60000, type: 'cents', category: 'tax', description: 'IRS 1099-K reporting threshold ($600)' },
  { key: 'tax.earlyWarningThresholdCents', value: 50000, type: 'cents', category: 'tax', description: 'Tax info collection trigger ($500)' },
  { key: 'tax.taxApiProvider', value: 'taxjar', type: 'string', category: 'tax', description: 'Third-party tax rate provider' },
  { key: 'tax.1099necThresholdCents', value: 60000, type: 'cents', category: 'tax', description: 'IRS 1099-NEC reporting threshold for affiliates ($600)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // KYC & IDENTITY VERIFICATION — G6 (Feature Lock-in §45)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'kyc.provider', value: 'stripe_identity', type: 'string', category: 'kyc', description: 'Third-party KYC provider' },
  { key: 'kyc.enhancedThresholdCents', value: 1000000, type: 'cents', category: 'kyc', description: 'Monthly payout threshold ($10,000) triggering enhanced verification' },
  { key: 'kyc.enhancedExpirationMonths', value: 24, type: 'number', category: 'kyc', description: 'Months before enhanced verification expires' },
  { key: 'kyc.failedRetryDays', value: 30, type: 'number', category: 'kyc', description: 'Days to retry after failed verification' },
  { key: 'kyc.autoVerifyBasic', value: true, type: 'boolean', category: 'kyc', description: 'Auto-verify basic level (email + phone) without manual review' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY — Additional keys from Platform Settings Canonical §14 (G6)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'privacy.retention.webhookLogDays', value: 90, type: 'number', category: 'privacy', description: 'Webhook log retention (days)' },
  { key: 'privacy.retention.analyticsEventDays', value: 365, type: 'number', category: 'privacy', description: 'Analytics event retention (1 year)' },
  { key: 'privacy.retention.notificationLogDays', value: 180, type: 'number', category: 'privacy', description: 'Notification log retention (days)' },
  { key: 'gdpr.exportFormats', value: ['json', 'csv'], type: 'array', category: 'privacy', description: 'Available data export formats' },
  { key: 'privacy.dataExportMaxHours', value: 48, type: 'number', category: 'privacy', description: 'Maximum hours to generate a data export (SLA)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY — G8 (GDPR Compliance & Automated Retention)
  // Note: retention.auditLogDays (2555, 7 years) already seeded above.
  // audit.retentionMonths (24) is the Feature Lock-in section 39 key
  // used by the cleanup cron job. Both keys are in use; the cron reads
  // audit.retentionMonths as the primary authority.
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'audit.retentionMonths', value: 24, type: 'number', category: 'privacy', description: 'Months before audit events are archived and purged (Feature Lock-in §39)' },
  { key: 'audit.archiveBeforePurge', value: true, type: 'boolean', category: 'privacy', description: 'Archive audit events to R2 cold storage before purging' },
  { key: 'privacy.orderRetentionYears', value: 7, type: 'number', category: 'privacy', description: 'Years to retain pseudonymized order data (legal/tax requirement per Decision #110)' },
  { key: 'privacy.granularAnalyticsRetentionDays', value: 90, type: 'number', category: 'privacy', description: 'Days before granular analytics data is purged (GDPR data minimization)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPDESK — G9 (Helpdesk Canonical §24.1)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'helpdesk.businessHours.start', value: '09:00', type: 'string', category: 'helpdesk', description: 'Business hours start time (HH:mm)' },
  { key: 'helpdesk.businessHours.end', value: '18:00', type: 'string', category: 'helpdesk', description: 'Business hours end time (HH:mm)' },
  { key: 'helpdesk.businessHours.timezone', value: 'America/New_York', type: 'string', category: 'helpdesk', description: 'Timezone for business hours' },
  { key: 'helpdesk.businessHours.workDays', value: [1, 2, 3, 4, 5], type: 'array', category: 'helpdesk', description: 'Work days (1=Mon, 5=Fri)' },
  { key: 'helpdesk.autoClose.pendingUserDays', value: 14, type: 'number', category: 'helpdesk', description: 'Days to auto-close PENDING_USER cases with no response' },
  { key: 'helpdesk.autoClose.resolvedDays', value: 7, type: 'number', category: 'helpdesk', description: 'Days to auto-close RESOLVED cases' },
  { key: 'helpdesk.reopen.windowDays', value: 7, type: 'number', category: 'helpdesk', description: 'Days after resolve that user can reopen case' },
  { key: 'helpdesk.csat.enabled', value: true, type: 'boolean', category: 'helpdesk', description: 'Enable CSAT survey collection' },
  { key: 'helpdesk.csat.surveyDelayMinutes', value: 30, type: 'number', category: 'helpdesk', description: 'Minutes to wait after resolution before sending CSAT email' },
  { key: 'helpdesk.roundRobin.enabled', value: true, type: 'boolean', category: 'helpdesk', description: 'Enable round-robin agent assignment' },
  { key: 'helpdesk.maxAttachments', value: 5, type: 'number', category: 'helpdesk', description: 'Maximum attachments per case message' },
  { key: 'helpdesk.maxAttachmentSizeMb', value: 10, type: 'number', category: 'helpdesk', description: 'Maximum attachment file size in MB' },
  { key: 'helpdesk.retentionDays', value: 365, type: 'number', category: 'helpdesk', description: 'Days to retain resolved/closed cases' },
  { key: 'helpdesk.email.signatureStripEnabled', value: true, type: 'boolean', category: 'helpdesk', description: 'Strip email signatures from inbound email messages' },
  // AI — G9.7 (helpdesk.ai.* settings)
  { key: 'helpdesk.ai.provider', value: 'anthropic', type: 'string', category: 'helpdesk', description: 'AI provider for helpdesk suggestions' },
  { key: 'helpdesk.ai.model', value: 'claude-haiku-4-5-20251001', type: 'string', category: 'helpdesk', description: 'Model ID for AI suggestion/assist' },
  { key: 'helpdesk.ai.suggestionEnabled', value: true, type: 'boolean', category: 'helpdesk', description: 'Enable AI-generated suggested reply on case workspace' },
  { key: 'helpdesk.ai.assistEnabled', value: true, type: 'boolean', category: 'helpdesk', description: 'Enable AI assist button in reply composer' },

  // Case templates — system-created messages per Canonical §30.2
  { key: 'helpdesk.templates.chargeback', value: 'We have received notification of a chargeback on your order. Our team is reviewing this case and will contact you within 24 hours.', type: 'string', category: 'helpdesk', description: 'Auto-message template for chargeback cases' },
  { key: 'helpdesk.templates.dispute', value: 'We have received your buyer protection claim and are reviewing the details. Our team will contact you within 48 hours.', type: 'string', category: 'helpdesk', description: 'Auto-message template for dispute cases' },
  { key: 'helpdesk.templates.return', value: 'We have received notice of a return escalation on your order. Our team is reviewing both sides and will be in touch shortly.', type: 'string', category: 'helpdesk', description: 'Auto-message template for return escalation cases' },
  { key: 'helpdesk.templates.moderation.message', value: 'We have received a report regarding a message in your conversation. Our moderation team is reviewing the report.', type: 'string', category: 'helpdesk', description: 'Auto-message template for moderation message cases' },
  { key: 'helpdesk.templates.moderation.listing', value: 'We have received a report regarding one of your listings. Our moderation team is reviewing the report and will follow up.', type: 'string', category: 'helpdesk', description: 'Auto-message template for moderation listing cases' },
  { key: 'helpdesk.templates.fraud', value: 'Our fraud detection system has flagged activity on your account. Our trust and safety team is investigating and will contact you.', type: 'string', category: 'helpdesk', description: 'Auto-message template for fraud detection cases' },
  { key: 'helpdesk.sla.warningThreshold', value: 0.75, type: 'number', category: 'helpdesk', description: 'SLA elapsed ratio at which warning is triggered (0.75 = 75%)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPUTE & CHARGEBACK DEFAULTS
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.dispute.chargebackDeadlineDays', value: 7, type: 'number', category: 'commerce', description: 'Default chargeback evidence deadline when Stripe does not provide one' },
  { key: 'commerce.shippingQuote.penaltyDiscountPercent', value: 25, type: 'number', category: 'commerce', description: 'Default penalty discount % when seller misses shipping quote deadline' },
  { key: 'commerce.priceAlert.minDropPercent', value: 5, type: 'number', category: 'commerce', description: 'Minimum allowed percent drop threshold for price alerts' },
  { key: 'commerce.priceAlert.maxDropPercent', value: 50, type: 'number', category: 'commerce', description: 'Maximum allowed percent drop threshold for price alerts' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY — G7 (Feature Lock-in §34, Platform Settings Canonical §16.1)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'accessibility.enforceMinContrast', value: true, type: 'boolean', category: 'accessibility', description: 'Prevents publishing themes/colors that fail WCAG AA contrast checks' },

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTING VIDEO — G3.11
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'listing.video.maxSizeBytes', value: 104857600, type: 'number', category: 'listing', description: 'Max video upload size in bytes (100MB)' },
  { key: 'listing.video.minDurationSeconds', value: 15, type: 'number', category: 'listing', description: 'Minimum video duration in seconds' },
  { key: 'listing.video.maxDurationSeconds', value: 60, type: 'number', category: 'listing', description: 'Maximum video duration in seconds' },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL PICKUP SCHEDULING — G2.9
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.local.schedulingMinLeadTimeHours', value: 1, type: 'number', category: 'local', description: 'Minimum lead time for meetup scheduling (hours)' },
  { key: 'commerce.local.schedulingMaxLeadTimeDays', value: 30, type: 'number', category: 'local', description: 'Maximum advance scheduling for meetups (days)' },
  { key: 'commerce.local.inconsistentMarkThreshold', value: 3, type: 'number', category: 'local', description: 'Reliability marks threshold for INCONSISTENT tier (engine-local audit D2)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT MODERATION — G4
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'moderation.report.maxPerUserPerDay', value: 10, type: 'number', category: 'moderation', description: 'Max content reports per user per 24 hours' },

  // Seller Score Engine + Enforcement settings — G4/G4.1/G4.2
  // (moved to v32-platform-settings-score-engine.ts)
  ...V32_SCORE_ENGINE_SETTINGS,

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS — G10.4 (Kill Switch + Launch Gates)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'featureFlags.killSwitch.requireConfirmation', value: true, type: 'boolean', category: 'featureFlags', description: 'Require confirmation dialog before toggling kill switches' },

  // ═══════════════════════════════════════════════════════════════════════════
  // JOBS — Cron schedules and scheduler settings
  // Changes take effect on next server restart.
  // ═══════════════════════════════════════════════════════════════════════════
];

// Combined export for backwards compatibility — consumers of V32_EXTENDED_SETTINGS get all settings
export const V32_EXTENDED_SETTINGS: PlatformSettingSeed[] = [
  ...V32_EXTENDED_SETTINGS_CORE,
  ...V32_EXTENDED_SETTINGS_PART2,
];
