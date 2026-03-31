/**
 * v3.2 Platform Settings — Extended Categories
 * Commerce, Fulfillment, Trust, Discovery, Communications, Privacy, Feature Flags
 * Category-adjusted score thresholds are in v32-platform-settings-score-thresholds.ts.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';
import { V32_SCORE_THRESHOLD_SETTINGS } from './v32-platform-settings-score-thresholds';

export const V32_EXTENDED_SETTINGS: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMMERCE — Cart, Offers, Orders, Listings
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'cart.expiryHours', value: 72, type: 'number', category: 'commerce', description: 'Cart items expire after this many hours' },
  { key: 'cart.maxItems', value: 100, type: 'number', category: 'commerce', description: 'Maximum items allowed in cart' },
  { key: 'cart.reservationMinutes', value: 15, type: 'number', category: 'commerce', description: 'Hold item in cart before releasing' },
  { key: 'cart.guestCheckoutEnabled', value: false, type: 'boolean', category: 'commerce', description: 'Allow checkout without account' },
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
  { key: 'bundle.minItems', value: 2, type: 'number', category: 'commerce', description: 'Minimum items required for bundle' },
  { key: 'bundle.smartPromptsEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Show bundle suggestions in cart' },
  { key: 'bundle.freeShippingPromptEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Suggest items for free shipping in cart' },
  { key: 'bundle.maxPromptsPerCart', value: 3, type: 'number', category: 'commerce', description: 'Max bundle prompts shown at once' },
  // Removed: order.autoCompleteAfterDays — dead config, code uses commerce.escrow.holdHours instead
  { key: 'order.buyerCancelWindowHours', value: 1, type: 'number', category: 'commerce', description: 'Hours buyer can cancel after purchase' },
  { key: 'order.maxItemsPerOrder', value: 50, type: 'number', category: 'commerce', description: 'Maximum items in single order' },
  { key: 'listing.maxImagesPerListing', value: 24, type: 'number', category: 'commerce', description: 'Maximum photos per listing' },
  { key: 'listing.minTitleLength', value: 10, type: 'number', category: 'commerce', description: 'Minimum characters in listing title' },
  { key: 'listing.maxTitleLength', value: 80, type: 'number', category: 'commerce', description: 'Maximum characters in listing title' },
  { key: 'listing.durationDays', value: 90, type: 'number', category: 'commerce', description: 'Default listing duration in days' },
  { key: 'listing.autoRenewEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Allow auto-renew of expired listings' },
  { key: 'cancellation.buyerWindowHours', value: 1, type: 'number', category: 'commerce', description: 'Hours buyer can cancel after purchase' },
  { key: 'cancellation.sellerPenaltyEnabled', value: true, type: 'boolean', category: 'commerce', description: 'Penalize sellers who cancel orders' },
  { key: 'cancellation.autoRefundOnCancel', value: true, type: 'boolean', category: 'commerce', description: 'Automatically refund on cancellation' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FULFILLMENT — Shipping, Returns, Insurance
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'shipping.defaultHandlingDays', value: 3, type: 'number', category: 'fulfillment', description: 'Default handling time in business days' },
  { key: 'shipping.maxHandlingDays', value: 7, type: 'number', category: 'fulfillment', description: 'Maximum allowed handling time' },
  { key: 'shipping.trackingRequiredAboveCents', value: 5000, type: 'cents', category: 'fulfillment', description: 'Require tracking for orders above this amount' },
  { key: 'shipping.signatureRequiredAboveCents', value: 75000, type: 'cents', category: 'fulfillment', description: 'Require signature for orders above this amount' },
  { key: 'shipping.defaultCarrier', value: 'USPS', type: 'string', category: 'fulfillment', description: 'Default shipping carrier' },
  { key: 'shipping.labelGenerationEnabled', value: true, type: 'boolean', category: 'fulfillment', description: 'Enable shipping label generation via Shippo' },
  { key: 'insurance.autoInsureAboveCents', value: 10000, type: 'cents', category: 'fulfillment', description: 'Auto-insure shipments above this amount ($100)' },
  { key: 'returns.windowDays', value: 30, type: 'number', category: 'fulfillment', description: 'Default return window in days' },
  { key: 'returns.restockingFeeBps', value: 0, type: 'bps', category: 'fulfillment', description: 'Restocking fee in basis points' },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // TRUST & QUALITY — Seller scores, reviews, standards
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'trust.baseScore', value: 80, type: 'number', category: 'trust', description: 'Starting trust score for new sellers' },
  { key: 'trust.bandExcellentMin', value: 90, type: 'number', category: 'trust', description: 'Minimum score for EXCELLENT trust band' },
  { key: 'trust.bandGoodMin', value: 75, type: 'number', category: 'trust', description: 'Minimum score for GOOD trust band' },
  { key: 'trust.bandWatchMin', value: 60, type: 'number', category: 'trust', description: 'Minimum score for WATCH trust band' },
  { key: 'trust.bandLimitedMin', value: 40, type: 'number', category: 'trust', description: 'Min trust score for limited status (below = listing-restricted)' },
  { key: 'trust.volumeCapped', value: 10, type: 'number', category: 'trust', description: 'Active listing cap for sellers in restricted status' },
  { key: 'trust.volumeLimited', value: 50, type: 'number', category: 'trust', description: 'Active listing cap for sellers in limited status' },
  { key: 'trust.decayHalfLifeDays', value: 90, type: 'number', category: 'trust', description: 'Days for event impact to halve' },
  { key: 'trust.event.review5Star', value: 1, type: 'number', category: 'trust', description: 'Trust score change for 5-star review' },
  { key: 'trust.event.lateShipment', value: -2, type: 'number', category: 'trust', description: 'Trust score change for late shipment' },
  { key: 'trust.event.sellerCancel', value: -3, type: 'number', category: 'trust', description: 'Trust score change for seller cancellation' },
  { key: 'trust.event.chargeback', value: -8, type: 'number', category: 'trust', description: 'Trust score change for chargeback' },
  { key: 'trust.event.policyViolation', value: -12, type: 'number', category: 'trust', description: 'Trust score change for policy violation' },
  { key: 'trust.event.review4Star', value: 0.5, type: 'number', category: 'trust', description: 'Trust score delta for 4-star review' },
  { key: 'trust.event.review3Star', value: -1.5, type: 'number', category: 'trust', description: 'Trust score delta for 3-star review' },
  { key: 'trust.event.review2Star', value: -4.0, type: 'number', category: 'trust', description: 'Trust score delta for 2-star review' },
  { key: 'trust.event.review1Star', value: -7.0, type: 'number', category: 'trust', description: 'Trust score delta for 1-star review' },
  { key: 'trust.event.refundSellerFault', value: -4.0, type: 'number', category: 'trust', description: 'Trust score delta when seller at fault for refund' },
  { key: 'trust.event.disputeOpened', value: -2.0, type: 'number', category: 'trust', description: 'Trust score delta when dispute opened against seller' },
  { key: 'trust.event.disputeSellerFault', value: -6.0, type: 'number', category: 'trust', description: 'Trust score delta when seller loses dispute' },
  { key: 'trust.review.eligibleDaysAfterDelivery', value: 3, type: 'number', category: 'trust', description: 'Days after delivery before review eligible' },
  { key: 'trust.review.windowDays', value: 60, type: 'number', category: 'trust', description: 'Days to leave review after eligible' },
  { key: 'review.allowSellerResponse', value: true, type: 'boolean', category: 'trust', description: 'Allow sellers to respond to reviews' },
  { key: 'review.moderationEnabled', value: true, type: 'boolean', category: 'trust', description: 'Enable review moderation' },
  { key: 'trust.review.editWindowHours', value: 24, type: 'number', category: 'trust', description: 'Hours to edit review after posting' },
  { key: 'trust.review.sellerResponseWindowDays', value: 30, type: 'number', category: 'trust', description: 'Days after review for seller to respond' },
  { key: 'standards.evaluationPeriodDays', value: 90, type: 'number', category: 'trust', description: 'Rolling window for seller standards evaluation' },
  { key: 'standards.maxDefectRatePercent', value: 2, type: 'number', category: 'trust', description: 'Max transaction defect rate for GOOD standing' },
  { key: 'standards.topRatedMinOrdersYear', value: 100, type: 'number', category: 'trust', description: 'Minimum annual orders for TOP_RATED' },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUYER QUALITY — Buyer quality tier thresholds
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'buyer.quality.yellow.returnRateMin', value: 0.05, type: 'number', category: 'trust', description: 'YELLOW tier min return rate (5%)' },
  { key: 'buyer.quality.yellow.returnRateMax', value: 0.15, type: 'number', category: 'trust', description: 'YELLOW tier max return rate (15%)' },
  { key: 'buyer.quality.yellow.cancelRateMin', value: 0.10, type: 'number', category: 'trust', description: 'YELLOW tier min cancel rate (10%)' },
  { key: 'buyer.quality.yellow.cancelRateMax', value: 0.25, type: 'number', category: 'trust', description: 'YELLOW tier max cancel rate (25%)' },
  { key: 'buyer.quality.yellow.disputeCount', value: 1, type: 'number', category: 'trust', description: 'YELLOW tier dispute count threshold' },
  { key: 'buyer.quality.red.returnRate', value: 0.15, type: 'number', category: 'trust', description: 'RED tier return rate threshold (>15%)' },
  { key: 'buyer.quality.red.cancelRate', value: 0.25, type: 'number', category: 'trust', description: 'RED tier cancel rate threshold (>25%)' },
  { key: 'buyer.quality.red.disputeCount', value: 2, type: 'number', category: 'trust', description: 'RED tier dispute count threshold (2+)' },
  { key: 'buyer.quality.minOrdersForRates', value: 3, type: 'number', category: 'trust', description: 'Minimum orders to calculate meaningful buyer quality rates' },
  { key: 'buyer.quality.minOrdersForVisibility', value: 5, type: 'number', category: 'trust', description: 'Minimum orders before showing buyer quality tier to sellers' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE BANDS — Seller score band thresholds
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'performance.band.powerSeller', value: 900, type: 'number', category: 'trust', description: 'Min score for POWER_SELLER band' },
  { key: 'performance.band.topRated', value: 750, type: 'number', category: 'trust', description: 'Min score for TOP_RATED band' },
  { key: 'performance.band.established', value: 550, type: 'number', category: 'trust', description: 'Min score for ESTABLISHED band' },

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
  { key: 'search.titleWeight', value: 10, type: 'number', category: 'discovery', description: 'Weight for title matches in search ranking' },
  { key: 'search.descriptionWeight', value: 3, type: 'number', category: 'discovery', description: 'Weight for description matches in search' },
  { key: 'search.trustMultiplierEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Boost trusted sellers in search results' },
  { key: 'search.freshnessBoostEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Boost recently listed items in search' },
  { key: 'search.defaultPageSize', value: 48, type: 'number', category: 'discovery', description: 'Default search results per page' },
  { key: 'promo.boostEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Enable promoted listings in search' },
  { key: 'promo.maxBoostMultiplier', value: 3, type: 'number', category: 'discovery', description: 'Maximum ranking boost for promoted listings' },
  { key: 'priceAlert.enabled', value: true, type: 'boolean', category: 'discovery', description: 'Enable price drop alerts' },
  { key: 'priceAlert.maxPerUser', value: 50, type: 'number', category: 'discovery', description: 'Maximum price alerts per user' },
  { key: 'marketIndex.enabled', value: true, type: 'boolean', category: 'discovery', description: 'Compute market price indexes' },
  { key: 'marketIndex.dealBadgesEnabled', value: true, type: 'boolean', category: 'discovery', description: 'Show Great Deal badges on listings' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATIONS — Email, push, SMS, messaging
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'email.enabled', value: true, type: 'boolean', category: 'comms', description: 'Enable email notifications globally' },
  { key: 'email.maxPerDayPerUser', value: 20, type: 'number', category: 'comms', description: 'Email rate limit per user per day' },
  { key: 'email.marketingEnabled', value: true, type: 'boolean', category: 'comms', description: 'Enable marketing email campaigns' },
  { key: 'push.enabled', value: true, type: 'boolean', category: 'comms', description: 'Enable push notifications globally' },
  { key: 'sms.enabled', value: false, type: 'boolean', category: 'comms', description: 'Enable SMS notifications globally' },
  { key: 'digest.enabled', value: true, type: 'boolean', category: 'comms', description: 'Enable email digest feature' },
  { key: 'digest.frequency', value: 'weekly', type: 'string', category: 'comms', description: 'Default digest frequency (daily/weekly/monthly)' },
  { key: 'messaging.enabled', value: true, type: 'boolean', category: 'comms', description: 'Enable buyer-seller direct messaging' },
  { key: 'messaging.rateLimitPerHour', value: 30, type: 'number', category: 'comms', description: 'Max messages per user per hour' },
  { key: 'messaging.moderationEnabled', value: true, type: 'boolean', category: 'comms', description: 'Enable message content moderation' },
  { key: 'comms.messaging.attachmentMaxBytes', value: 10_485_760, type: 'number', category: 'comms', description: 'Message attachment max file size (bytes)' },
  { key: 'comms.messaging.bannedKeywords', value: [], type: 'array', category: 'comms', description: 'Banned keyword list for message moderation (managed via /cfg/messaging/keywords)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY — Data retention, GDPR
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'retention.messageDays', value: 730, type: 'number', category: 'privacy', description: 'Keep messages for this many days (2 years)' },
  { key: 'retention.searchLogDays', value: 90, type: 'number', category: 'privacy', description: 'Keep search logs for this many days' },
  { key: 'retention.auditLogDays', value: 2555, type: 'number', category: 'privacy', description: 'Keep audit logs for compliance (7 years)' },
  { key: 'gdpr.dataExportEnabled', value: true, type: 'boolean', category: 'privacy', description: 'Allow users to export their data' },
  { key: 'gdpr.deletionGracePeriodDays', value: 30, type: 'number', category: 'privacy', description: 'Days before permanent deletion after request' },
  { key: 'gdpr.anonymizeOnDeletion', value: true, type: 'boolean', category: 'privacy', description: 'Anonymize vs hard delete user data' },
  { key: 'gdpr.cookieConsentRequired', value: true, type: 'boolean', category: 'privacy', description: 'Require cookie consent banner' },

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
  // PERSONALIZATION — Purchase Signals
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'discovery.personalization.purchaseWeight', value: 2.0, type: 'number', category: 'discovery', description: 'Weight assigned to purchase-based interest signals' },
  { key: 'discovery.personalization.purchaseExpiryDays', value: 90, type: 'number', category: 'discovery', description: 'Days before a purchase-based interest signal expires' },

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
  { key: 'retention.webhookLogDays', value: 90, type: 'number', category: 'privacy', description: 'Webhook log retention (days)' },
  { key: 'retention.analyticsEventDays', value: 365, type: 'number', category: 'privacy', description: 'Analytics event retention (1 year)' },
  { key: 'retention.notificationLogDays', value: 180, type: 'number', category: 'privacy', description: 'Notification log retention (days)' },
  { key: 'retention.exportExpiryDays', value: 7, type: 'number', category: 'privacy', description: 'Data export file retention before purge (days)' },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SELLER STANDARDS & ENFORCEMENT — G4 (Seller Score Canonical Section 11.5)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'score.enforcement.coachingBelow', value: 550, type: 'number', category: 'trust', description: 'Seller score threshold triggering coaching level' },
  { key: 'score.enforcement.warningBelow', value: 400, type: 'number', category: 'trust', description: 'Seller score threshold triggering warning level' },
  { key: 'score.enforcement.restrictionBelow', value: 250, type: 'number', category: 'trust', description: 'Seller score threshold triggering restriction level' },
  { key: 'score.enforcement.preSuspensionBelow', value: 100, type: 'number', category: 'trust', description: 'Seller score threshold triggering pre-suspension level' },
  { key: 'score.enforcement.warningDurationDays', value: 30, type: 'number', category: 'trust', description: 'Days seller has to improve during warning period' },
  { key: 'score.enforcement.restrictionDurationDays', value: 90, type: 'number', category: 'trust', description: 'Days before restriction escalates if no improvement' },
  { key: 'score.enforcement.preSuspensionDays', value: 30, type: 'number', category: 'trust', description: 'Days before admin review during pre-suspension' },
  // G4.2 — Enforcement Appeal Settings
  { key: 'score.enforcement.appealWindowDays', value: 30, type: 'number', category: 'trust', description: 'Days after enforcement action issued to file an appeal' },
  { key: 'score.enforcement.maxAppealsPerAction', value: 1, type: 'number', category: 'trust', description: 'Maximum appeals allowed per enforcement action' },
  { key: 'score.enforcement.appealReviewSlaHours', value: 48, type: 'number', category: 'trust', description: 'Staff SLA hours to review an appeal' },
  { key: 'score.enforcement.appealableActionTypes', value: ['WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION', 'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION'], type: 'array', category: 'trust', description: 'Enforcement action types that can be appealed (COACHING, REVIEW_REMOVAL, ACCOUNT_BAN are not appealable)' },

  // Feature Lock-in Section 44 — seller standards evaluation window settings
  { key: 'sellerStandards.evaluationWindowDays', value: 90, type: 'number', category: 'trust', description: 'Rolling window in days for seller standards metric calculation' },
  { key: 'sellerStandards.minimumOrders', value: 10, type: 'number', category: 'trust', description: 'Minimum orders before enforcement actions can be triggered' },
  { key: 'sellerStandards.warningPeriodDays', value: 30, type: 'number', category: 'trust', description: 'Days for seller to improve after receiving a warning' },
  { key: 'sellerStandards.restrictionToSuspensionDays', value: 90, type: 'number', category: 'trust', description: 'Days at restriction level before escalation to suspension review' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SELLER SCORE ENGINE — G4.1 (Seller Score Canonical Section 11)
  // Score Configuration (Section 11.1)
  { key: 'score.smoothingFactor', value: 30, type: 'number', category: 'trust', description: 'Bayesian smoothing factor (number of "ghost" orders at platform mean)' },
  { key: 'score.trendModifierMax', value: 0.05, type: 'number', category: 'trust', description: 'Maximum trend modifier as a fraction (+/- 5%)' },
  { key: 'score.recalcSchedule', value: '0 3 * * *', type: 'string', category: 'trust', description: 'Cron schedule for daily seller score recalculation (3 AM UTC)' },
  { key: 'score.platformMeanRecalcSchedule', value: '0 4 * * 0', type: 'string', category: 'trust', description: 'Cron schedule for weekly platform mean score recalculation (4 AM UTC Sunday)' },
  { key: 'score.newSellerOrderThreshold', value: 10, type: 'number', category: 'trust', description: 'Minimum completed orders before a seller receives a performance score' },
  { key: 'score.transitionOrderThreshold', value: 50, type: 'number', category: 'trust', description: 'Orders before search multiplier is fully unlocked (no longer clamped to 0.95-1.10)' },
  { key: 'score.downgradeGraceDays', value: 7, type: 'number', category: 'trust', description: 'Consecutive days below threshold before band downgrade is applied' },

  // Band Thresholds — use performance.band.* keys (see lines 124-126)

  // Metric Weights (Section 11.3) — must sum to 1.0
  { key: 'score.weight.onTimeShipping', value: 0.25, type: 'number', category: 'trust', description: 'Weight for on-time shipping metric in score calculation' },
  { key: 'score.weight.inadRate', value: 0.20, type: 'number', category: 'trust', description: 'Weight for INAD claim rate metric in score calculation' },
  { key: 'score.weight.reviewAverage', value: 0.20, type: 'number', category: 'trust', description: 'Weight for review average metric in score calculation' },
  { key: 'score.weight.responseTime', value: 0.15, type: 'number', category: 'trust', description: 'Weight for response time metric in score calculation' },
  { key: 'score.weight.returnRate', value: 0.10, type: 'number', category: 'trust', description: 'Weight for return rate metric in score calculation' },
  { key: 'score.weight.cancellationRate', value: 0.10, type: 'number', category: 'trust', description: 'Weight for cancellation rate metric in score calculation' },

  // Category-Adjusted Thresholds (Section 11.4) — see v32-platform-settings-score-thresholds.ts
  ...V32_SCORE_THRESHOLD_SETTINGS,

  // Reward Configuration (Section 11.6) — seeded but implementation deferred
  { key: 'score.rewards.powerSellerBoostCreditCents', value: 1500, type: 'cents', category: 'trust', description: 'Monthly boost credit for POWER_SELLER band (cents)' },
  { key: 'score.rewards.topRatedBoostCreditCents', value: 1000, type: 'cents', category: 'trust', description: 'Monthly boost credit for TOP_RATED band (cents)' },
  { key: 'score.rewards.boostCreditIssueDay', value: 1, type: 'number', category: 'trust', description: 'Day of month boost credits are issued' },
  { key: 'score.rewards.boostCreditExpireDays', value: 30, type: 'number', category: 'trust', description: 'Days until issued boost credits expire' },
  { key: 'score.rewards.protectionScoreBoost.powerSeller', value: 15, type: 'number', category: 'trust', description: 'Buyer protection score boost for POWER_SELLER sellers' },
  { key: 'score.rewards.protectionScoreBoost.topRated', value: 10, type: 'number', category: 'trust', description: 'Buyer protection score boost for TOP_RATED sellers' },
  { key: 'score.rewards.protectionScoreBoost.established', value: 5, type: 'number', category: 'trust', description: 'Buyer protection score boost for ESTABLISHED sellers' },

  // Coaching Tips (Section 11.7)
  { key: 'score.tips.onTimeShipping', value: ['Ship within your stated handling time to maintain a high on-time rate', 'Enable shipping reminders to avoid late shipments', 'Consider using pre-printed shipping labels for faster processing'], type: 'array', category: 'trust', description: 'Coaching tips for improving on-time shipping rate' },
  { key: 'score.tips.inadRate', value: ['Add more photos showing item condition from all angles', 'Include measurements and detailed condition notes in your descriptions', 'Disclose all flaws, wear, and imperfections in the listing'], type: 'array', category: 'trust', description: 'Coaching tips for reducing INAD claim rate' },
  { key: 'score.tips.responseTime', value: ['Enable push notifications for new messages', 'Set up message alerts on your phone to respond quickly', 'Check your messages at least twice daily'], type: 'array', category: 'trust', description: 'Coaching tips for improving response time' },
  { key: 'score.tips.returnRate', value: ['Use detailed condition descriptions to set accurate buyer expectations', 'Photograph items in natural light to show true colors', 'Include close-ups of any wear, stains, or defects'], type: 'array', category: 'trust', description: 'Coaching tips for reducing return rate' },
  { key: 'score.tips.cancellationRate', value: ['Only list items you have in hand and ready to ship', 'Keep your inventory up to date across platforms', 'If you crosslist, update stock counts promptly after sales'], type: 'array', category: 'trust', description: 'Coaching tips for reducing cancellation rate' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS — G10.4 (Kill Switch + Launch Gates)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'featureFlags.killSwitch.requireConfirmation', value: true, type: 'boolean', category: 'featureFlags', description: 'Require confirmation dialog before toggling kill switches' },

  // ═══════════════════════════════════════════════════════════════════════════
  // JOBS — Cron schedules and scheduler settings
  // Changes take effect on next server restart.
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'jobs.cron.orders.pattern', value: '0 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for auto-completing delivered orders (default: every hour at :00)' },
  { key: 'jobs.cron.returns.pattern', value: '10 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for auto-approving overdue returns (default: every hour at :10)' },
  { key: 'jobs.cron.shipping.pattern', value: '20 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for scanning shipping exceptions (default: every hour at :20)' },
  { key: 'jobs.cron.health.pattern', value: '*/5 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for system health checks (default: every 5 minutes)' },
  { key: 'jobs.cron.vacation.pattern', value: '0 0 * * *', type: 'string', category: 'jobs', description: 'Cron pattern for ending expired vacation modes (default: midnight UTC)' },
  { key: 'jobs.cron.sellerScoreRecalc.pattern', value: '0 3 * * *', type: 'string', category: 'jobs', description: 'Cron pattern for seller score recalculation (default: 3 AM UTC)' },
  { key: 'jobs.scheduler.tickIntervalMs', value: 5000, type: 'number', category: 'jobs', description: 'Crosslister scheduler tick interval in milliseconds (default: 5000). Restart required.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE — Service connection URLs
  // These reflect the env vars used at startup. Changing them here
  // updates the health check targets but actual connections require restart.
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'infrastructure.valkey.host', value: '127.0.0.1', type: 'string', category: 'infrastructure', description: 'Valkey host (matches VALKEY_HOST env var — restart required to reconnect)' },
  { key: 'infrastructure.valkey.port', value: 6379, type: 'number', category: 'infrastructure', description: 'Valkey port (matches VALKEY_PORT env var — restart required to reconnect)' },
  { key: 'infrastructure.typesense.url', value: 'http://127.0.0.1:8108', type: 'string', category: 'infrastructure', description: 'Typesense base URL (matches TYPESENSE_URL env var — restart required)' },
  { key: 'infrastructure.centrifugo.apiUrl', value: 'http://127.0.0.1:8000', type: 'string', category: 'infrastructure', description: 'Centrifugo API URL (matches CENTRIFUGO_API_URL env var — restart required)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GEOCODING — Address lookup & autocomplete
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'geocoding.enabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Master switch for geocoding' },
  { key: 'geocoding.cacheEnabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Cache geocoding results to avoid repeat lookups' },
  { key: 'geocoding.cacheTtlDays', value: 365, type: 'number', category: 'infrastructure', description: 'How long to cache geocoded addresses (days)' },
  { key: 'geocoding.confidenceThreshold', value: 0.6, type: 'number', category: 'infrastructure', description: 'Minimum confidence score to accept a geocoding result (0–1)' },
  { key: 'geocoding.batchSizeLimit', value: 500, type: 'number', category: 'infrastructure', description: 'Max addresses per batch geocoding job' },
  { key: 'geocoding.batchDelayMs', value: 50, type: 'number', category: 'infrastructure', description: 'Delay between individual requests in a batch (ms)' },
  { key: 'geocoding.defaultCountry', value: 'US', type: 'string', category: 'infrastructure', description: 'Default country code for geocoding bias' },
  { key: 'geocoding.autocompleteEnabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Enable address autocomplete in forms' },
  { key: 'geocoding.autocompleteMinChars', value: 3, type: 'number', category: 'infrastructure', description: 'Minimum characters before triggering autocomplete' },
  { key: 'geocoding.autocompleteDebounceMs', value: 300, type: 'number', category: 'infrastructure', description: 'Debounce delay for autocomplete requests (ms)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE LIMITING — Request throttles and lockout policy
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'rateLimit.enabled', value: true, type: 'boolean', category: 'security', description: 'Master switch for rate limiting' },
  { key: 'rateLimit.guestSearchPerMinute', value: 60, type: 'number', category: 'security', description: 'Guest search rate limit per minute' },
  { key: 'rateLimit.loginMaxAttempts', value: 5, type: 'number', category: 'security', description: 'Failed login attempts before lockout' },
  { key: 'rateLimit.loginLockoutMinutes', value: 15, type: 'number', category: 'security', description: 'Lockout duration after max failed attempts (minutes)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS — Dispute fees, chargeback handling, reconciliation
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'payments.disputeFilingFeeCents', value: 0, type: 'cents', category: 'payments', description: 'Fee charged when dispute is filed (0 = free to file)' },
  { key: 'payments.disputeSellerFeeCents', value: 2000, type: 'cents', category: 'payments', description: 'Fee charged to seller if dispute is lost ($20)' },
  { key: 'payments.chargebackFeeCents', value: 1500, type: 'cents', category: 'payments', description: 'Fee charged for chargebacks ($15)' },
  { key: 'payments.chargebackReversalCreditCents', value: 1500, type: 'cents', category: 'payments', description: 'Credit issued if chargeback is reversed ($15)' },
  { key: 'payments.waiveFirstDisputeFee', value: false, type: 'boolean', category: 'payments', description: 'Waive fee for seller first dispute' },
  { key: 'payments.disputeFeeWaiverLimit', value: 1, type: 'number', category: 'payments', description: 'Max disputes to waive per seller per year' },
  { key: 'payments.reconciliationFrequency', value: 'daily', type: 'string', category: 'payments', description: 'How often to run reconciliation (hourly, daily, weekly)' },
  { key: 'payments.reconciliationTimeUtc', value: '02:00', type: 'string', category: 'payments', description: 'UTC time to run daily reconciliation' },
  { key: 'payments.autoResolveSmallDiscrepancies', value: true, type: 'boolean', category: 'payments', description: 'Auto-resolve discrepancies under threshold' },
  { key: 'payments.autoResolveThresholdCents', value: 100, type: 'cents', category: 'payments', description: 'Max discrepancy to auto-resolve ($1)' },
  { key: 'payments.ledgerRetentionYears', value: 7, type: 'number', category: 'payments', description: 'Years to retain ledger entries' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATIONS — Newsletter and marketing opt-in
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'newsletter.enabled', value: true, type: 'boolean' as const, category: 'comms', description: 'Enable newsletter subscription form on homepage and footer' },
  { key: 'newsletter.doubleOptIn', value: false, type: 'boolean' as const, category: 'comms', description: 'Require email confirmation before adding subscriber (reserved for future use)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENSION — Browser extension feature flags and configuration (H1.1)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'extension.enabled', value: true, type: 'boolean' as const, category: 'extension', description: 'Extension enabled' },
  { key: 'extension.registrationEnabled', value: true, type: 'boolean' as const, category: 'extension', description: 'Extension registration enabled' },
  { key: 'extension.heartbeatIntervalMinutes', value: 5, type: 'number' as const, category: 'extension', description: 'Heartbeat interval (minutes)' },
  { key: 'extension.sessionTokenExpiryDays', value: 30, type: 'number' as const, category: 'extension', description: 'Extension token expiry (days)' },
  { key: 'extension.version.minimum', value: '0.1.0', type: 'string' as const, category: 'extension', description: 'Minimum supported extension version' },
  { key: 'extension.version.latest', value: '0.1.0', type: 'string' as const, category: 'extension', description: 'Latest extension version' },
  { key: 'extension.registrationTokenExpiryMinutes', value: 5, type: 'number' as const, category: 'extension', description: 'Registration token expiry (minutes)' },
  { key: 'extension.scrapeCacheTtlSeconds', value: 3600, type: 'number' as const, category: 'extension', description: 'Scrape cache TTL in Valkey (seconds)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER-C CONNECTORS — Anti-detection delay configuration (H4.x)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.tierC.delayMinMs', value: 2000, type: 'number' as const, category: 'crosslister', description: 'Tier-C connector minimum human-like delay (ms)' },
  { key: 'crosslister.tierC.delayMaxMs', value: 8000, type: 'number' as const, category: 'crosslister', description: 'Tier-C connector maximum human-like delay (ms)' },
];
