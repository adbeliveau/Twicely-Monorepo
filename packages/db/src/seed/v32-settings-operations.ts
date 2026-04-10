/**
 * v3.2 Platform Settings — Operations & Infrastructure
 * Automation, Bundles, Boosting, Overages, Authentication, Local,
 * Stripe costs, Shipping, Feature Flags.
 *
 * Split from v32-platform-settings.ts to stay under 300 lines.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const V32_SETTINGS_OPERATIONS: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATION (Section 8)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'automation.pricing.annualCents', value: 999, type: 'cents', category: 'automation', description: 'Automation annual price/mo ($9.99)' },
  { key: 'automation.pricing.monthlyCents', value: 1299, type: 'cents', category: 'automation', description: 'Automation monthly price ($12.99)' },
  { key: 'automation.actionsPerMonth', value: 2000, type: 'number', category: 'automation', description: 'Included actions per month' },
  { key: 'automation.overagePackSize', value: 1000, type: 'number', category: 'automation', description: 'Actions per overage pack' },
  { key: 'automation.overagePackCents', value: 900, type: 'cents', category: 'automation', description: 'Overage pack price ($9.00)' },
  { key: 'automation.poshmark.dailyActionLimit', value: 200, type: 'number', category: 'automation', description: 'Max Poshmark sharing actions per seller per day' },
  { key: 'automation.poshmark.minDelayMs', value: 2000, type: 'number', category: 'automation', description: 'Min delay between Poshmark sharing actions (ms)' },
  { key: 'automation.poshmark.maxDelayMs', value: 8000, type: 'number', category: 'automation', description: 'Max delay between Poshmark sharing actions (ms)' },

  // ── Automation Platform Feature Flags (F6-FIX: FIX 2) ──────────────────
  { key: 'automation.ebay.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for eBay' },
  { key: 'automation.poshmark.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Poshmark' },
  { key: 'automation.mercari.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Mercari' },
  { key: 'automation.depop.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Depop' },
  { key: 'automation.fb_marketplace.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Facebook Marketplace' },
  { key: 'automation.etsy.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Etsy' },
  { key: 'automation.grailed.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Grailed' },
  { key: 'automation.therealreal.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for TheRealReal' },

  // ── Per-Seller Circuit Breaker Thresholds (F6-FIX: FIX 4) ─────────────
  { key: 'automation.circuitBreaker.level1Failures', value: 3, type: 'number', category: 'automation', description: 'Consecutive failures before Level 1 automation pause' },
  { key: 'automation.circuitBreaker.level1PauseMs', value: 3600000, type: 'number', category: 'automation', description: 'Level 1 automation pause duration (1 hour)' },
  { key: 'automation.circuitBreaker.level2Failures', value: 5, type: 'number', category: 'automation', description: 'Consecutive failures before Level 2 automation pause' },
  { key: 'automation.circuitBreaker.level2PauseMs', value: 86400000, type: 'number', category: 'automation', description: 'Level 2 automation pause duration (24 hours)' },

  // ── Poshmark Follow Engine (F6-FIX: FIX 5) ────────────────────────────
  { key: 'automation.poshmark.dailyFollowLimit', value: 50, type: 'number', category: 'automation', description: 'Max Poshmark follow actions per seller per day' },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUNDLES (Section 9)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'bundle.minItems', value: 2, type: 'number', category: 'bundle', description: 'Minimum items in a bundle offer' },
  { key: 'bundle.maxItems', value: 10, type: 'number', category: 'bundle', description: 'Maximum items in a bundle offer' },
  { key: 'bundle.maxCounterRounds', value: 1, type: 'number', category: 'bundle', description: 'Maximum counter-offer rounds for bundle offers (standard offers use commerce.offer.maxCounterDepth)' },
  { key: 'bundle.starter.annualCents', value: 1799, type: 'cents', category: 'bundle', description: 'Seller Starter bundle annual/mo ($17.99)' },
  { key: 'bundle.starter.monthlyCents', value: 2499, type: 'cents', category: 'bundle', description: 'Seller Starter bundle monthly ($24.99)' },
  { key: 'bundle.pro.annualCents', value: 5999, type: 'cents', category: 'bundle', description: 'Seller Pro bundle annual/mo ($59.99)' },
  { key: 'bundle.pro.monthlyCents', value: 7499, type: 'cents', category: 'bundle', description: 'Seller Pro bundle monthly ($74.99)' },
  { key: 'bundle.power.annualCents', value: 8999, type: 'cents', category: 'bundle', description: 'Seller Power bundle annual/mo ($89.99)' },
  { key: 'bundle.power.monthlyCents', value: 10999, type: 'cents', category: 'bundle', description: 'Seller Power bundle monthly ($109.99)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOSTING (Section 10)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'boost.minRateBps', value: 100, type: 'bps', category: 'boost', description: 'Minimum boost rate (1%)' },
  { key: 'boost.maxRateBps', value: 800, type: 'bps', category: 'boost', description: 'Maximum boost rate (8%)' },
  { key: 'boost.attributionDays', value: 7, type: 'number', category: 'boost', description: 'Attribution window in days' },
  { key: 'boost.maxPromotedPercentBps', value: 3000, type: 'bps', category: 'boost', description: 'Max % of search results that can be promoted (3000 bps = 30%)' },
  { key: 'boost.refundOnReturn', value: true, type: 'boolean', category: 'boost', description: 'Refund boost fees on returns' },
  { key: 'boost.minimumStoreTier', value: 'PRO', type: 'string', category: 'boost', description: 'Minimum store tier for boosting' },

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERAGE PACKS (Section 13)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'overage.publishes.qty', value: 500, type: 'number', category: 'overage', description: 'Publishes per overage pack' },
  { key: 'overage.publishes.cents', value: 900, type: 'cents', category: 'overage', description: 'Publish pack price ($9.00)' },
  { key: 'overage.aiCredits.qty', value: 500, type: 'number', category: 'overage', description: 'AI credits per overage pack' },
  { key: 'overage.aiCredits.cents', value: 900, type: 'cents', category: 'overage', description: 'AI credits pack price ($9.00)' },
  { key: 'overage.bgRemovals.qty', value: 500, type: 'number', category: 'overage', description: 'BG removals per overage pack' },
  { key: 'overage.bgRemovals.cents', value: 900, type: 'cents', category: 'overage', description: 'BG removals pack price ($9.00)' },
  { key: 'overage.automation.qty', value: 1000, type: 'number', category: 'overage', description: 'Automation actions per overage pack' },
  { key: 'overage.automation.cents', value: 900, type: 'cents', category: 'overage', description: 'Automation pack price ($9.00)' },
  { key: 'overage.autoMaxPacksPerMonth', value: 3, type: 'number', category: 'overage', description: 'Maximum auto-purchased overage packs per month' },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION (Section 14)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'auth.buyerFeeCents', value: 1999, type: 'cents', category: 'auth', description: 'Buyer authentication fee ($19.99)' },
  { key: 'auth.sellerFeeCents', value: 1999, type: 'cents', category: 'auth', description: 'Seller authentication fee ($19.99)' },
  { key: 'auth.expertFeeCents', value: 3999, type: 'cents', category: 'auth', description: 'Expert authentication fee ($39.99)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL (Section 15)
  // ═══════════════════════════════════════════════════════════════════════════
  // commerce.local.tfRateBps removed — Decision #118: local TF now uses standard progressive brackets
  { key: 'commerce.local.confirmationCodeExpiryHours', value: 48, type: 'number', category: 'commerce.local', description: 'Hours until QR confirmation code expires from scheduled meetup time' },
  { key: 'commerce.local.noShowFeeCents', value: 500, type: 'cents', category: 'commerce.local', description: '[DEPRECATED] Fee charged to no-show party — superseded by reliability marks (G2.8)' },
  { key: 'commerce.local.noShowStrikeLimit', value: 3, type: 'number', category: 'commerce.local', description: '[DEPRECATED] No-shows before suspension — superseded by suspensionMarkThreshold (G2.8)' },
  { key: 'commerce.local.noShowSuspensionDays', value: 90, type: 'number', category: 'commerce.local', description: '[DEPRECATED] Suspension days — superseded by suspensionDays (G2.8)' },
  { key: 'commerce.local.suspensionMarkThreshold', value: 9, type: 'number', category: 'commerce.local', description: 'Reliability marks in 90-day window before local suspension' },
  { key: 'commerce.local.suspensionDays', value: 90, type: 'number', category: 'commerce.local', description: 'Days local transactions suspended after threshold reached' },
  { key: 'commerce.local.markDecayDays', value: 180, type: 'number', category: 'commerce.local', description: 'Days after which reliability marks stop counting' },
  { key: 'commerce.local.meetupAutoCancelMinutes', value: 30, type: 'number', category: 'commerce.local', description: 'Minutes until auto-cancel when one party checks in but other does not' },
  { key: 'commerce.local.offlineGraceHours', value: 2, type: 'number', category: 'commerce.local', description: 'Hours offline grace period before buyer must confirm online' },
  { key: 'commerce.local.claimWindowDays', value: 7, type: 'number', category: 'commerce.local', description: 'Days from QR confirmation within which buyer can file a local claim' },
  { key: 'commerce.local.defaultRadiusMiles', value: 25, type: 'number', category: 'commerce.local', description: 'Default search radius for local pickup (miles)' },
  { key: 'commerce.local.maxRadiusMiles', value: 50, type: 'number', category: 'commerce.local', description: 'Maximum search radius for local pickup (miles)' },
  { key: 'commerce.local.safetyEscalationMinutes', value: 15, type: 'number', category: 'commerce.local', description: 'Minutes after safety nudge before auto-creating support case' },
  { key: 'commerce.local.maxAdjustmentPercent', value: 33, type: 'number', category: 'commerce.local', description: 'Maximum price reduction percentage at meetup (33 = max 33% discount)' },
  { key: 'commerce.local.autoCancelHours', value: 48, type: 'number', category: 'commerce.local', description: 'Hours until auto-cancel when meetup is not completed' },
  { key: 'commerce.local.offlineModeEnabled', value: true, type: 'boolean', category: 'commerce.local', description: 'Enable offline dual-token verification mode for local meetups' },
  { key: 'commerce.local.preloadTokensOnEscrow', value: true, type: 'boolean', category: 'commerce.local', description: 'Push tokens to both phones at escrow creation (before meetup)' },
  { key: 'commerce.local.tokenExpiryHours', value: 48, type: 'number', category: 'commerce.local', description: 'Hours until Ed25519 tokens expire from scheduled meetup time' },
  { key: 'commerce.local.meetupReminder24HrOffset', value: 24, type: 'number', category: 'commerce.local', description: 'Hours before meetup to send 24-hour reminder notification' },
  { key: 'commerce.local.meetupReminder1HrOffset', value: 1, type: 'number', category: 'commerce.local', description: 'Hours before meetup to send 1-hour reminder notification' },
  { key: 'commerce.local.scheduleReminderHours', value: 24, type: 'number', category: 'commerce.local', description: 'Hours after checkout before nudging unscheduled local transactions' },
  { key: 'commerce.local.rescheduleMaxCount', value: 2, type: 'number', category: 'commerce.local', description: 'Maximum reschedules per local transaction before reliability marks apply (3rd reschedule = -1 mark)' },
  { key: 'commerce.local.inconsistentMarkThreshold', value: 3, type: 'number', category: 'commerce.local', description: 'Reliability marks at which user tier becomes INCONSISTENT (display threshold)' },
  { key: 'commerce.local.markNoShow', value: -3, type: 'number', category: 'commerce.local', description: 'Reliability marks applied for a no-show event' },
  { key: 'commerce.local.markRescheduleExcess', value: -1, type: 'number', category: 'commerce.local', description: 'Reliability marks applied for excess reschedules (beyond rescheduleMaxCount)' },
  { key: 'commerce.local.safetyNudgeMinutes', value: 30, type: 'number', category: 'commerce.local', description: 'Minutes after BOTH_CHECKED_IN before safety nudge sent' },
  { key: 'commerce.local.cancelLateHours', value: 24, type: 'number', category: 'commerce.local', description: 'Hours before meetup that defines late cancellation boundary' },
  { key: 'commerce.local.cancelSamedayHours', value: 2, type: 'number', category: 'commerce.local', description: 'Hours before meetup that defines same-day cancellation boundary' },
  { key: 'commerce.local.markCancelLate', value: -1, type: 'number', category: 'commerce', description: 'Reliability marks for late cancellation (under cancelLateHours)' },
  { key: 'commerce.local.markCancelSameday', value: -2, type: 'number', category: 'commerce', description: 'Reliability marks for same-day cancellation (under cancelSamedayHours)' },
  { key: 'commerce.local.dayOfConfirmationWindowHours', value: 12, type: 'number', category: 'commerce.local', description: 'Hours before scheduledAt when buyer can send day-of confirmation request' },
  { key: 'commerce.local.dayOfConfirmationResponseHours', value: 2, type: 'number', category: 'commerce.local', description: 'Hours seller has to respond before SELLER_DARK mark + escalation' },
  { key: 'commerce.local.markSellerDark', value: -1, type: 'number', category: 'commerce.local', description: 'Reliability marks for seller going dark on day-of confirmation' },
  // G2.15 — Escrow Fraud Detection (Addendum §A12)
  { key: 'commerce.local.fraudNoshowRelistCheckHours', value: 24, type: 'number', category: 'commerce.local', description: 'Hours after no-show before checking if seller relisted' },
  { key: 'commerce.local.phashFraudCheckEnabled', value: false, type: 'boolean', category: 'commerce.local', description: 'Enable pHash duplicate detection (deferred — set to false)' },
  { key: 'commerce.local.fraudPatternOffenseCount', value: 2, type: 'number', category: 'commerce.local', description: 'Number of confirmed fraud flags before full account suspension' },

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE COSTS (Section 3.2) - Platform absorbs these
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'stripe.activeAccountFeeCents', value: 200, type: 'cents', category: 'stripe', description: 'Monthly active account fee ($2.00)' },
  { key: 'stripe.payoutFixedCents', value: 25, type: 'cents', category: 'stripe', description: 'Per payout fixed fee ($0.25)' },
  { key: 'stripe.payoutPercentBps', value: 25, type: 'bps', category: 'stripe', description: 'Per payout percentage (0.25%)' },
  { key: 'stripe.fundsRoutingBps', value: 25, type: 'bps', category: 'stripe', description: 'Funds routing fee (0.25%)' },
  { key: 'stripe.instantPayoutBps', value: 100, type: 'bps', category: 'stripe', description: 'Instant payout fee (1%)' },
  { key: 'stripe.subscriptionBillingBps', value: 50, type: 'bps', category: 'stripe', description: 'Subscription billing fee (0.5%)' },
  { key: 'stripe.irsEfileCents', value: 299, type: 'cents', category: 'stripe', description: '1099 IRS e-file fee ($2.99)' },
  { key: 'stripe.stateEfileCents', value: 149, type: 'cents', category: 'stripe', description: '1099 state e-file fee ($1.49)' },
  { key: 'commerce.stripe.processingRateBps', value: 290, type: 'bps', category: 'commerce.stripe', description: 'Stripe processing rate (2.9%)' },
  { key: 'commerce.stripe.processingFixedCents', value: 30, type: 'cents', category: 'commerce.stripe', description: 'Stripe processing fixed fee ($0.30)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBINED SHIPPING — QUOTED MODE (D2.2)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.shipping.combinedQuoteDeadlineHours', value: 48, type: 'number', category: 'commerce.shipping', description: 'Hours seller has to provide a combined shipping quote' },
  { key: 'commerce.shipping.combinedPenaltyDiscountPercent', value: 25, type: 'number', category: 'commerce.shipping', description: 'Penalty discount applied if seller misses combined shipping quote deadline (%)' },
  { key: 'commerce.shipping.autoDiscountMinPercent', value: 10, type: 'number', category: 'commerce.shipping', description: 'Minimum auto-discount percentage for AUTO_DISCOUNT combined shipping mode' },
  { key: 'commerce.shipping.autoDiscountMaxPercent', value: 75, type: 'number', category: 'commerce.shipping', description: 'Maximum auto-discount percentage for AUTO_DISCOUNT combined shipping mode' },
  { key: 'commerce.shipping.lostInTransitDays', value: 7, type: 'number', category: 'commerce.shipping', description: 'Days without tracking update before marking lost in transit' },
  { key: 'commerce.shipping.significantDelayDays', value: 14, type: 'number', category: 'commerce.shipping', description: 'Days past expected delivery before marking significant delay' },
  { key: 'commerce.returns.estimatedShippingCents', value: 800, type: 'cents', category: 'commerce.returns', description: 'Estimated return shipping cost in cents' },
  { key: 'commerce.returns.sellerResponseDeadlineDays', value: 3, type: 'number', category: 'commerce.returns', description: 'Business days seller has to respond to a return request' },
  { key: 'commerce.returns.sellerResponseDeadlineHour', value: 17, type: 'number', category: 'commerce.returns', description: 'Hour of day (0-23) for seller response deadline cutoff (e.g. 17 = 5 PM)' },
  { key: 'commerce.seller.defaultOnTimeShippingPct', value: 100, type: 'number', category: 'commerce.seller', description: 'Default on-time shipping percentage for new sellers with no performance history' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS (E4)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'featureFlags.cacheSeconds', value: 30, type: 'number', category: 'featureFlags', description: 'Valkey cache TTL in seconds for feature flag values' },
  { key: 'featureFlags.requireApprovalForProduction', value: false, type: 'boolean', category: 'featureFlags', description: 'Require 2-person approval for production flag changes' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOTIONS (V4 Phase 6)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'promotions.budgetMonitor.tickPattern', value: '*/5 * * * *', type: 'string', category: 'promotions', description: 'Cron pattern for campaign budget monitor job (default: every 5 min)' },
];
