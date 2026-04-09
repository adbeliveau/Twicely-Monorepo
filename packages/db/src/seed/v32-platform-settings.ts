/**
 * v3.2 Platform Settings Constants
 * All configurable values from TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
 * Zero hardcoded values in application code.
 */

export interface PlatformSettingSeed {
  key: string;
  value: unknown;
  type: 'number' | 'string' | 'boolean' | 'cents' | 'bps' | 'array';
  category: string;
  description: string;
}

export const V32_PLATFORM_SETTINGS_CORE: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL / ENVIRONMENT (Settings Hub)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'general.siteName', value: 'Twicely', type: 'string', category: 'general', description: 'Platform name displayed to users' },
  { key: 'general.supportEmail', value: 'support@twicely.co', type: 'string', category: 'general', description: 'Support contact email address' },
  { key: 'general.siteDescription', value: 'Buy and sell pre-loved items', type: 'string', category: 'general', description: 'Platform description' },
  { key: 'general.maintenanceMode', value: false, type: 'boolean', category: 'general', description: 'Disable public access to the platform' },
  { key: 'general.registrationEnabled', value: true, type: 'boolean', category: 'general', description: 'Allow new users to register' },
  { key: 'general.sellerRegistrationEnabled', value: true, type: 'boolean', category: 'general', description: 'Allow users to become sellers' },
  { key: 'general.defaultCurrency', value: 'USD', type: 'string', category: 'general', description: 'Default currency for the platform' },
  { key: 'general.minListingPriceCents', value: 100, type: 'cents', category: 'general', description: 'Minimum price sellers can set for listings' },
  { key: 'general.maxListingPriceCents', value: 10000000, type: 'cents', category: 'general', description: 'Maximum price sellers can set for listings' },
  { key: 'general.staffInactivityTimeoutMinutes', value: 5, type: 'number', category: 'general', description: 'Staff sessions logged out after this many minutes of inactivity' },
  { key: 'general.staffSessionAbsoluteHours', value: 8, type: 'number', category: 'general', description: 'Staff session absolute timeout in hours (session expires regardless of activity)' },
  { key: 'general.staffSessionWarningSeconds', value: 60, type: 'number', category: 'general', description: 'Seconds before session timeout to show the warning modal' },
  { key: 'general.impersonationTokenTtlMinutes', value: 15, type: 'number', category: 'general', description: 'Staff impersonation token TTL in minutes (HMAC cookie expiry — Decision #133)' },
  { key: 'general.userInactivityTimeoutMinutes', value: 1440, type: 'number', category: 'general', description: 'User sessions logged out after this many minutes of inactivity (default 24h)' },
  { key: 'general.userSessionMaxDays', value: 30, type: 'number', category: 'general', description: 'Maximum session lifetime for users regardless of activity' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TF BRACKETS (Section 2.4) - Progressive marginal rates
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.tf.bracket1.maxCents', value: 49900, type: 'cents', category: 'commerce.tf', description: 'Bracket 1 ceiling ($499)' },
  { key: 'commerce.tf.bracket1.rate', value: 1000, type: 'bps', category: 'commerce.tf', description: 'Bracket 1 TF rate (10.00%)' },
  { key: 'commerce.tf.bracket2.maxCents', value: 199900, type: 'cents', category: 'commerce.tf', description: 'Bracket 2 ceiling ($1,999)' },
  { key: 'commerce.tf.bracket2.rate', value: 1100, type: 'bps', category: 'commerce.tf', description: 'Bracket 2 TF rate (11.00%)' },
  { key: 'commerce.tf.bracket3.maxCents', value: 499900, type: 'cents', category: 'commerce.tf', description: 'Bracket 3 ceiling ($4,999)' },
  { key: 'commerce.tf.bracket3.rate', value: 1050, type: 'bps', category: 'commerce.tf', description: 'Bracket 3 TF rate (10.50%)' },
  { key: 'commerce.tf.bracket4.maxCents', value: 999900, type: 'cents', category: 'commerce.tf', description: 'Bracket 4 ceiling ($9,999)' },
  { key: 'commerce.tf.bracket4.rate', value: 1000, type: 'bps', category: 'commerce.tf', description: 'Bracket 4 TF rate (10.00%)' },
  { key: 'commerce.tf.bracket5.maxCents', value: 2499900, type: 'cents', category: 'commerce.tf', description: 'Bracket 5 ceiling ($24,999)' },
  { key: 'commerce.tf.bracket5.rate', value: 950, type: 'bps', category: 'commerce.tf', description: 'Bracket 5 TF rate (9.50%)' },
  { key: 'commerce.tf.bracket6.maxCents', value: 4999900, type: 'cents', category: 'commerce.tf', description: 'Bracket 6 ceiling ($49,999)' },
  { key: 'commerce.tf.bracket6.rate', value: 900, type: 'bps', category: 'commerce.tf', description: 'Bracket 6 TF rate (9.00%)' },
  { key: 'commerce.tf.bracket7.maxCents', value: 9999900, type: 'cents', category: 'commerce.tf', description: 'Bracket 7 ceiling ($99,999)' },
  { key: 'commerce.tf.bracket7.rate', value: 850, type: 'bps', category: 'commerce.tf', description: 'Bracket 7 TF rate (8.50%)' },
  { key: 'commerce.tf.bracket8.maxCents', value: -1, type: 'cents', category: 'commerce.tf', description: 'Bracket 8 ceiling (unlimited, -1 sentinel)' },
  { key: 'commerce.tf.bracket8.rate', value: 800, type: 'bps', category: 'commerce.tf', description: 'Bracket 8 TF rate (8.00%)' },
  { key: 'commerce.tf.minimumCents', value: 50, type: 'cents', category: 'commerce.tf', description: 'Minimum TF per order ($0.50)' },
  { key: 'commerce.tf.gmvWindowType', value: 'calendar_month', type: 'string', category: 'commerce.tf', description: 'GMV calculation window type' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ESCROW (Section 5.2)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'commerce.escrow.holdHours', value: 72, type: 'number', category: 'commerce.escrow', description: 'Hours to hold funds after delivery' },
  { key: 'commerce.dispute.reviewDeadlineHours', value: 48, type: 'number', category: 'commerce.dispute', description: 'Hours platform has to review a dispute before auto-escalation' },
  { key: 'commerce.offer.declineCooldownHours', value: 24, type: 'number', category: 'commerce', description: 'Declined offer cooldown (hours) — buyer cannot re-submit the same offer amount for this many hours' },
  { key: 'commerce.escrow.autoReleaseEnabled', value: true, type: 'boolean', category: 'commerce.escrow', description: 'Auto-release after hold period' },
  { key: 'commerce.escrow.buyerEarlyAcceptEnabled', value: true, type: 'boolean', category: 'commerce.escrow', description: 'Allow buyer early acceptance' },

  // ── ORDER & CHECKOUT ───────────────────────────────────────────────────────
  { key: 'commerce.order.minimumCents', value: 100, type: 'cents', category: 'commerce.order', description: 'Minimum order value in cents ($1.00)' },
  { key: 'commerce.checkout.rateLimitWindowSec', value: 600, type: 'number', category: 'commerce.checkout', description: 'Checkout rate-limit window in seconds (default 10 min)' },
  { key: 'commerce.checkout.rateLimitMaxAttempts', value: 5, type: 'number', category: 'commerce.checkout', description: 'Max checkout attempts per user within the window before blocking' },

  // ── SUBSCRIPTION ───────────────────────────────────────────────────────────
  { key: 'commerce.subscription.trialDays', value: 14, type: 'number', category: 'commerce.subscription', description: 'Default trial length in days for new subscriptions' },

  // ── CHARGEBACK ─────────────────────────────────────────────────────────────
  { key: 'commerce.chargeback.feeCents', value: 1500, type: 'cents', category: 'commerce.chargeback', description: 'Platform chargeback fee charged to seller ($15.00)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYOUT (Section 5.4)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'payout.weeklyDay', value: 5, type: 'number', category: 'payout', description: 'Weekly payout day (5=Friday)' },
  { key: 'payout.weeklyTime', value: '06:00', type: 'string', category: 'payout', description: 'Weekly payout time (UTC)' },
  { key: 'payout.dailyTime', value: '06:00', type: 'string', category: 'payout', description: 'Daily payout time (UTC)' },
  { key: 'payout.minimumNoneCents', value: 1500, type: 'cents', category: 'payout', description: 'Minimum payout for NONE tier ($15)' },
  { key: 'payout.minimumStarterCents', value: 1000, type: 'cents', category: 'payout', description: 'Minimum payout for STARTER tier ($10)' },
  { key: 'payout.minimumProCents', value: 100, type: 'cents', category: 'payout', description: 'Minimum payout for PRO tier ($1)' },
  { key: 'payout.minimumPowerCents', value: 100, type: 'cents', category: 'payout', description: 'Minimum payout for POWER tier ($1)' },
  { key: 'payout.minimumEnterpriseCents', value: 0, type: 'cents', category: 'payout', description: 'Minimum payout for ENTERPRISE tier ($0)' },
  { key: 'payout.instantFeeCents', value: 250, type: 'cents', category: 'payout', description: 'Instant payout fee ($2.50)' },
  { key: 'payout.dailyFeeCents', value: 100, type: 'cents', category: 'payout', description: 'Daily payout fee ($1.00)' },
  { key: 'payout.instantMaxCents', value: 25000, type: 'cents', category: 'payout', description: 'Maximum instant payout ($250)' },
  { key: 'payout.instantEnabled', value: true, type: 'boolean', category: 'payout', description: 'Enable instant payouts' },
  { key: 'payout.onPlatformFeePaymentEnabled', value: true, type: 'boolean', category: 'payout', description: 'Allow paying platform fees from payout balance' },
  { key: 'commerce.payout.delayDays', value: 2, type: 'number', category: 'payout', description: 'Stripe payout delay days (minimum hold before funds are released to seller bank)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // STORE PRICING (Section 4.3)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'store.pricing.starter.annualCents', value: 699, type: 'cents', category: 'store', description: 'Store Starter annual price/mo ($6.99)' },
  { key: 'store.pricing.starter.monthlyCents', value: 1200, type: 'cents', category: 'store', description: 'Store Starter monthly price ($12.00)' },
  { key: 'store.pricing.pro.annualCents', value: 2999, type: 'cents', category: 'store', description: 'Store Pro annual price/mo ($29.99)' },
  { key: 'store.pricing.pro.monthlyCents', value: 3999, type: 'cents', category: 'store', description: 'Store Pro monthly price ($39.99)' },
  { key: 'store.pricing.power.annualCents', value: 5999, type: 'cents', category: 'store', description: 'Store Power annual price/mo ($59.99)' },
  { key: 'store.pricing.power.monthlyCents', value: 7999, type: 'cents', category: 'store', description: 'Store Power monthly price ($79.99)' },
  { key: 'fees.insertion.NONE', value: 35, type: 'cents', category: 'fees', description: 'Insertion fee for NONE tier ($0.35)' },
  { key: 'fees.insertion.STARTER', value: 25, type: 'cents', category: 'fees', description: 'Insertion fee for STARTER tier ($0.25)' },
  { key: 'fees.insertion.PRO', value: 10, type: 'cents', category: 'fees', description: 'Insertion fee for PRO tier ($0.10)' },
  { key: 'fees.insertion.POWER', value: 5, type: 'cents', category: 'fees', description: 'Insertion fee for POWER tier ($0.05)' },
  { key: 'fees.insertion.ENTERPRISE', value: 0, type: 'cents', category: 'fees', description: 'Insertion fee for ENTERPRISE tier ($0.00)' },
  { key: 'fees.freeListings.NONE', value: 100, type: 'number', category: 'fees', description: 'Free listings/mo for NONE tier' },
  { key: 'fees.freeListings.STARTER', value: 250, type: 'number', category: 'fees', description: 'Free listings/mo for STARTER tier' },
  { key: 'fees.freeListings.PRO', value: 2000, type: 'number', category: 'fees', description: 'Free listings/mo for PRO tier' },
  { key: 'fees.freeListings.POWER', value: 15000, type: 'number', category: 'fees', description: 'Free listings/mo for POWER tier' },
  { key: 'fees.freeListings.ENTERPRISE', value: 100000, type: 'number', category: 'fees', description: 'Free listings/mo for ENTERPRISE tier' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSSLISTER PRICING (Section 6.4)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.pricing.lite.annualCents', value: 999, type: 'cents', category: 'crosslister', description: 'Crosslister Lite annual price/mo ($9.99)' },
  { key: 'crosslister.pricing.lite.monthlyCents', value: 1399, type: 'cents', category: 'crosslister', description: 'Crosslister Lite monthly price ($13.99)' },
  { key: 'crosslister.pricing.pro.annualCents', value: 2999, type: 'cents', category: 'crosslister', description: 'Crosslister Pro annual price/mo ($29.99)' },
  { key: 'crosslister.pricing.pro.monthlyCents', value: 3999, type: 'cents', category: 'crosslister', description: 'Crosslister Pro monthly price ($39.99)' },
  { key: 'crosslister.publishes.FREE', value: 5, type: 'number', category: 'crosslister', description: 'Publishes/mo for FREE tier' },
  { key: 'crosslister.publishes.LITE', value: 200, type: 'number', category: 'crosslister', description: 'Publishes/mo for LITE tier' },
  { key: 'crosslister.publishes.PRO', value: 2000, type: 'number', category: 'crosslister', description: 'Publishes/mo for PRO tier' },
  { key: 'crosslister.aiCredits.LITE', value: 25, type: 'number', category: 'crosslister', description: 'AI credits/mo for LITE tier' },
  { key: 'crosslister.aiCredits.PRO', value: 200, type: 'number', category: 'crosslister', description: 'AI credits/mo for PRO tier' },
  { key: 'crosslister.bgRemovals.LITE', value: 25, type: 'number', category: 'crosslister', description: 'BG removals/mo for LITE tier' },
  { key: 'crosslister.bgRemovals.PRO', value: 200, type: 'number', category: 'crosslister', description: 'BG removals/mo for PRO tier' },
  { key: 'crosslister.rolloverDays', value: 60, type: 'number', category: 'crosslister', description: 'Days before unused credits expire' },
  { key: 'crosslister.rolloverMaxMultiplier', value: 3, type: 'number', category: 'crosslister', description: 'Max rollover as multiplier of monthly allowance' },
  { key: 'crosslister.freeTierMonths', value: 6, type: 'number', category: 'crosslister', description: 'Months a new seller has FREE ListerTier before downgrade to NONE' },

  // ── Image retention (Decision #111) ─────────────────────────────────────
  { key: 'crosslister.images.variantPurgeAfterDays', value: 120, type: 'number', category: 'crosslister', description: 'Days after sold/ended before non-cover image variants are purged (Decision #111 stage 2)' },
  { key: 'crosslister.images.fullPurgeAfterDays', value: 730, type: 'number', category: 'crosslister', description: 'Days after sold/ended before all images and the listing record are deleted (Decision #111 stage 3, ~2 years)' },
  { key: 'crosslister.images.batchSize', value: 200, type: 'number', category: 'crosslister', description: 'Max listings processed per retention pass (per stage)' },
  { key: 'jobs.cron.listingImageRetention.pattern', value: '30 4 * * *', type: 'string', category: 'crosslister', description: 'Cron pattern for the listing image retention job (default: daily at 04:30 UTC)' },

  // ── Monthly Boost Credit (Seller Score Canonical §5.4) ──────────────────
  { key: 'score.rewards.powerSellerMonthlyCreditCents', value: 1500, type: 'cents', category: 'score', description: 'Monthly boost credit for POWER_SELLER band ($15.00)' },
  { key: 'score.rewards.topRatedMonthlyCreditCents', value: 1000, type: 'cents', category: 'score', description: 'Monthly boost credit for TOP_RATED band ($10.00)' },
  { key: 'score.rewards.batchSize', value: 500, type: 'number', category: 'score', description: 'Max sellers processed per batch in monthly boost credit job' },
  { key: 'jobs.cron.monthlyBoostCredit.pattern', value: '0 6 1 * *', type: 'string', category: 'score', description: 'Cron pattern for monthly boost credit issuance (default: 06:00 UTC on the 1st of each month)' },

  // ── SOLD listing Typesense purge (Decision #71 — 90-day index window) ───
  { key: 'search.soldPurge.retentionDays', value: 90, type: 'number', category: 'search', description: 'Days after soldAt before a SOLD listing is purged from the Typesense index (Decision #71)' },
  { key: 'search.soldPurge.batchSize', value: 500, type: 'number', category: 'search', description: 'Max SOLD listing documents deleted from Typesense per purge pass' },
  { key: 'jobs.cron.listingSoldPurge.pattern', value: '0 3 * * *', type: 'string', category: 'search', description: 'Cron pattern for the SOLD listing Typesense purge job (default: daily at 03:00 UTC)' },

  // ── Polling intervals (Decision Rationale #96) ──────────────────────────
  { key: 'crosslister.polling.hot.intervalMs', value: 90000, type: 'number', category: 'crosslister', description: 'HOT polling interval in ms (90 seconds)' },
  { key: 'crosslister.polling.warm.intervalMs', value: 600000, type: 'number', category: 'crosslister', description: 'WARM polling interval in ms (10 minutes)' },
  { key: 'crosslister.polling.cold.intervalMs', value: 2700000, type: 'number', category: 'crosslister', description: 'COLD polling interval in ms (45 minutes)' },
  { key: 'crosslister.polling.longtail.intervalMs', value: 14400000, type: 'number', category: 'crosslister', description: 'LONGTAIL polling interval in ms (4 hours)' },

  // ── Polling budget per ListerTier (Decision Rationale #96) ──────────────
  { key: 'crosslister.polling.budget.NONE', value: 10, type: 'number', category: 'crosslister', description: 'Polls/hr for NONE tier (import projections only, sale detection minimum)' },
  { key: 'crosslister.polling.budget.FREE', value: 20, type: 'number', category: 'crosslister', description: 'Polls/hr for FREE tier (5 active projections max)' },
  { key: 'crosslister.polling.budget.LITE', value: 200, type: 'number', category: 'crosslister', description: 'Polls/hr for LITE tier' },
  { key: 'crosslister.polling.budget.PRO', value: 1000, type: 'number', category: 'crosslister', description: 'Polls/hr for PRO tier' },

  // ── HOT decay and double-sell (Decision Rationale #96) ──────────────────
  { key: 'crosslister.polling.hotDecayDwellMs', value: 1800000, type: 'number', category: 'crosslister', description: 'WARM dwell time after HOT expires before returning to previous tier (30 min)' },
  { key: 'crosslister.polling.doubleSellThreshold', value: 0.02, type: 'number', category: 'crosslister', description: 'Double-sell rate threshold that triggers HOT elevation for all seller projections' },
  { key: 'crosslister.polling.doubleSellReleaseRate', value: 0.01, type: 'number', category: 'crosslister', description: 'Rate must drop below this for doubleSellReleaseDays before HOT is released' },
  { key: 'crosslister.polling.doubleSellReleaseDays', value: 7, type: 'number', category: 'crosslister', description: 'Consecutive days below doubleSellReleaseRate before forced HOT is released' },
  { key: 'crosslister.polling.coldDemotionDays', value: 7, type: 'number', category: 'crosslister', description: 'Days since last poll before demoting to COLD tier' },
  { key: 'crosslister.polling.longtailDemotionDays', value: 30, type: 'number', category: 'crosslister', description: 'Days since last poll before demoting to LONGTAIL tier' },
  { key: 'crosslister.polling.batchSize', value: 100, type: 'number', category: 'crosslister', description: 'Max projections processed per scheduler tick' },
  { key: 'crosslister.polling.webhookPrimaryChannels', value: '["EBAY","ETSY"]', type: 'string', category: 'crosslister', description: 'JSON array of channels where webhooks are primary signal — HOT/WARM tiers skip polling for these' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSSLISTER SCHEDULER (loop tick + batch sizes — Lister Canonical §8.4)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.scheduler.tickIntervalMs', value: 5000, type: 'number', category: 'crosslister', description: 'Scheduler dispatch loop tick interval in ms (requires worker restart to take effect)' },
  { key: 'crosslister.scheduler.batchPullSize', value: 50, type: 'number', category: 'crosslister', description: 'Max PENDING jobs pulled per scheduler tick' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSSLISTER QUEUE (BullMQ priorities, attempts, backoff, retention)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.queue.priority.poll', value: 700, type: 'number', category: 'crosslister', description: 'BullMQ priority for POLL jobs (lower = higher priority)' },
  { key: 'crosslister.queue.priority.create', value: 300, type: 'number', category: 'crosslister', description: 'BullMQ priority for CREATE/PUBLISH jobs' },
  { key: 'crosslister.queue.priority.sync', value: 500, type: 'number', category: 'crosslister', description: 'BullMQ priority for SYNC/UPDATE jobs' },
  { key: 'crosslister.queue.priority.delist', value: 100, type: 'number', category: 'crosslister', description: 'BullMQ priority for DELIST jobs (highest priority — seller intent)' },
  { key: 'crosslister.queue.maxAttempts.poll', value: 2, type: 'number', category: 'crosslister', description: 'Max retry attempts for POLL jobs' },
  { key: 'crosslister.queue.maxAttempts.publish', value: 3, type: 'number', category: 'crosslister', description: 'Max retry attempts for PUBLISH/CREATE jobs' },
  { key: 'crosslister.queue.maxAttempts.sync', value: 3, type: 'number', category: 'crosslister', description: 'Max retry attempts for SYNC/UPDATE jobs' },
  { key: 'crosslister.queue.backoffMs.poll', value: 60000, type: 'number', category: 'crosslister', description: 'Initial exponential backoff delay for POLL job retries (ms)' },
  { key: 'crosslister.queue.backoffMs.publish', value: 30000, type: 'number', category: 'crosslister', description: 'Initial exponential backoff delay for PUBLISH job retries (ms)' },
  { key: 'crosslister.queue.backoffMs.sync', value: 60000, type: 'number', category: 'crosslister', description: 'Initial exponential backoff delay for SYNC job retries (ms)' },
  { key: 'crosslister.queue.removeOnCompleteCount', value: 1000, type: 'number', category: 'crosslister', description: 'Number of completed jobs to retain in BullMQ for debugging' },
  { key: 'crosslister.queue.removeOnFailCount', value: 5000, type: 'number', category: 'crosslister', description: 'Number of failed jobs to retain in BullMQ for admin inspection' },
  { key: 'crosslister.queue.workerConcurrency', value: 10, type: 'number', category: 'crosslister', description: 'BullMQ worker concurrency for the lister-publish queue (requires worker restart)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSSLISTER AUTOMATION ENGINE (auto-relist, price drop, offer-to-likers, posh share/follow)
  // Business settings (pricing, daily action limits) live under the automation.* namespace.
  // These are engine internals — priorities, tick intervals, fire hours, backoff.
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.automation.jobPriority', value: 700, type: 'number', category: 'crosslister', description: 'BullMQ priority for automation jobs (lower = higher priority)' },
  { key: 'crosslister.automation.workerConcurrency', value: 5, type: 'number', category: 'crosslister', description: 'BullMQ worker concurrency for the lister-automation queue (requires worker restart)' },
  { key: 'crosslister.automation.tickIntervalMs', value: 3600000, type: 'number', category: 'crosslister', description: 'Automation scheduler tick interval (default 1 hour). Determines how often the automation scheduler checks the UTC clock to fire engines.' },
  { key: 'crosslister.automation.autoRelistHourUTC', value: 3, type: 'number', category: 'crosslister', description: 'UTC hour at which the auto-relist engine fires (0-23)' },
  { key: 'crosslister.automation.priceDropHourUTC', value: 4, type: 'number', category: 'crosslister', description: 'UTC hour at which the price-drop engine fires (0-23)' },
  { key: 'crosslister.automation.offerToLikersHourUTC', value: 10, type: 'number', category: 'crosslister', description: 'UTC hour at which the offer-to-likers engine fires (0-23)' },
  { key: 'crosslister.automation.offerCooldownDays', value: 7, type: 'number', category: 'crosslister', description: 'Cooldown period in days between offer-to-likers sends for the same projection' },
  { key: 'crosslister.automation.maxAttempts', value: 2, type: 'number', category: 'crosslister', description: 'Max retry attempts for AUTOMATION jobs' },
  { key: 'crosslister.automation.backoffMs.first', value: 60000, type: 'number', category: 'crosslister', description: 'First retry backoff delay for AUTOMATION jobs (60s)' },
  { key: 'crosslister.automation.backoffMs.second', value: 300000, type: 'number', category: 'crosslister', description: 'Second retry backoff delay for AUTOMATION jobs (300s)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCE PRICING (Financial Center Canonical v3.0 §2)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'finance.pricing.pro.annualTotalCents', value: 14388, type: 'cents', category: 'finance', description: 'Finance Pro annual total ($143.88/yr)' },
  { key: 'finance.pricing.pro.annualCents', value: 1199, type: 'cents', category: 'finance', description: 'Finance Pro annual price/mo ($11.99)' },
  { key: 'finance.pricing.pro.monthlyCents', value: 1499, type: 'cents', category: 'finance', description: 'Finance Pro monthly price ($14.99)' },
  { key: 'finance.trialMonths.bundlePromo', value: 6, type: 'number', category: 'finance', description: 'Free trial months with bundle' },
  { key: 'finance.foldThreshold', value: 30, type: 'number', category: 'finance', description: 'Conversion % below which Finance folds into Store' },
  { key: 'finance.storeTierTrialMonths', value: 6, type: 'number', category: 'finance', description: 'Finance PRO trial months with first Store activation' },
  { key: 'finance.storeTierTrialRepeatable', value: false, type: 'boolean', category: 'finance', description: 'Whether Store-tier Finance trial can restart on re-subscribe' },
  { key: 'finance.mileageRatePerMile', value: 0.70, type: 'number', category: 'finance', description: 'IRS standard mileage rate per mile (dollars)' },
  { key: 'finance.mileageRateYear', value: 2026, type: 'number', category: 'finance', description: 'Year the mileage rate applies to' },
  { key: 'finance.defaultCurrency', value: 'USD', type: 'string', category: 'finance', description: 'Default currency for financial center' },

  // ── Receipt Scanning (Financial Center Canonical v3.0 §9) ─────────────
  { key: 'finance.receiptScanCredits.pro', value: 50, type: 'number', category: 'finance', description: 'Receipt scans/mo for PRO tier' },
  { key: 'finance.receiptScanCredits.overageCents', value: 25, type: 'cents', category: 'finance', description: 'Per-scan overage cost ($0.25)' },
  { key: 'finance.receiptScanCredits.rollover', value: false, type: 'boolean', category: 'finance', description: 'Whether unused receipt credits roll over' },
  { key: 'finance.receiptScanning.usageKey', value: 'receipt-scanning', type: 'string', category: 'finance', description: 'Usage key for receipt scanning provider' },
  { key: 'finance.receiptScanning.provider', value: 'anthropic', type: 'string', category: 'finance', description: 'AI provider for receipt scanning' },
  { key: 'finance.receiptScanning.model', value: 'claude-sonnet-4-6', type: 'string', category: 'finance', description: 'AI model for receipt scanning' },
  { key: 'finance.receiptScanning.maxImageSizeMb', value: 10, type: 'number', category: 'finance', description: 'Maximum receipt image size in MB' },
  { key: 'finance.receiptScanning.confidenceAutoAccept', value: 85, type: 'number', category: 'finance', description: 'Confidence threshold for auto-accepting receipt data' },
  { key: 'finance.receiptScanning.confidenceConfirmPrompt', value: 60, type: 'number', category: 'finance', description: 'Confidence threshold for showing confirm prompt' },
  { key: 'finance.receiptScanning.supportedFormats', value: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'], type: 'array', category: 'finance', description: 'Supported receipt image MIME types' },

  // ── Custom categories (Financial Center Canonical v3.0 §9) ────────────
  { key: 'finance.customCategories.maxPerSeller', value: 10, type: 'number', category: 'finance', description: 'Max custom expense categories per seller' },

  // ── Report Retention (Financial Center Canonical v3.0) ──────────────
  { key: 'finance.reportRetentionDays.free', value: 30, type: 'number', category: 'finance', description: 'Report history retention for FREE finance tier (days)' },
  { key: 'finance.reportRetentionYears.pro', value: 2, type: 'number', category: 'finance', description: 'Report history retention for PRO finance tier (years)' },

  // ── Inventory Aging Buckets (Financial Center Canonical v3.0 §6.8) ────
  { key: 'finance.inventoryAging.freshDays', value: 30, type: 'number', category: 'finance', description: 'Days until listing moves from Fresh to Slowing' },
  { key: 'finance.inventoryAging.slowingDays', value: 60, type: 'number', category: 'finance', description: 'Days until listing moves from Slowing to Stale' },
  { key: 'finance.inventoryAging.staleDays', value: 90, type: 'number', category: 'finance', description: 'Days until listing moves from Stale to Dead' },
  { key: 'finance.inventoryAging.deadDays', value: 180, type: 'number', category: 'finance', description: 'Days until listing enters Long-tail bucket' },

  // ── Intelligence Layer Data Gates (Financial Center Canonical v3.0 §6) ─
  { key: 'finance.projection.minimumHistoryDays', value: 90, type: 'number', category: 'finance', description: 'Minimum account history days for projections' },
  { key: 'finance.projection.minimumOrders', value: 10, type: 'number', category: 'finance', description: 'Minimum orders required for projection compute' },
  { key: 'finance.projection.dataQualityThreshold', value: 60, type: 'number', category: 'finance', description: 'Minimum data quality score (0-100) for projection display' },
  { key: 'finance.breakeven.minimumHistoryMonths', value: 3, type: 'number', category: 'finance', description: 'Minimum months of data for break-even calculator' },
  { key: 'finance.yoy.minimumMonths', value: 13, type: 'number', category: 'finance', description: 'Minimum months for year-over-year comparisons' },

  // ── Health Score (Financial Center Canonical v3.0 §6.3) ───────────────
  { key: 'finance.healthScore.minimumHistoryDays', value: 60, type: 'number', category: 'finance', description: 'Minimum account history days for health score' },
  { key: 'finance.healthScore.minimumOrders', value: 10, type: 'number', category: 'finance', description: 'Minimum orders for health score visibility' },
  { key: 'finance.healthScore.weights.profitMarginTrend', value: 25, type: 'number', category: 'finance', description: 'Health score weight: profit margin trend (%)' },
  { key: 'finance.healthScore.weights.expenseRatio', value: 20, type: 'number', category: 'finance', description: 'Health score weight: expense ratio (%)' },
  { key: 'finance.healthScore.weights.sellThroughVelocity', value: 20, type: 'number', category: 'finance', description: 'Health score weight: sell-through velocity (%)' },
  { key: 'finance.healthScore.weights.inventoryAge', value: 20, type: 'number', category: 'finance', description: 'Health score weight: inventory age distribution (%)' },
  { key: 'finance.healthScore.weights.revenueGrowth', value: 15, type: 'number', category: 'finance', description: 'Health score weight: revenue growth (%)' },

  // ── Performing Periods (Financial Center Canonical v3.0 §6.10) ────────
  { key: 'finance.performingPeriods.minimumHistoryDays', value: 90, type: 'number', category: 'finance', description: 'Minimum history for performing periods analysis' },
  { key: 'finance.performingPeriods.minimumOrders', value: 20, type: 'number', category: 'finance', description: 'Minimum orders for performing periods analysis' },

  // ── Capital Efficiency (Financial Center Canonical v3.0 §6.9) ─────────
  { key: 'finance.capitalEfficiency.minimumSoldWithCogs', value: 10, type: 'number', category: 'finance', description: 'Minimum sold items with COGS for capital efficiency' },
  { key: 'finance.capitalEfficiency.minimumHistoryDays', value: 30, type: 'number', category: 'finance', description: 'Minimum history days for capital efficiency' },
  { key: 'finance.inventoryTurns.healthyLow', value: 150, type: 'number', category: 'finance', description: 'Healthy inventory turns low bound (1.5× in bps)' },
  { key: 'finance.inventoryTurns.healthyHigh', value: 250, type: 'number', category: 'finance', description: 'Healthy inventory turns high bound (2.5× in bps)' },

  // ── Profit by Category (Financial Center Canonical v3.0 §6.4) ─────────
  { key: 'finance.profitByCategory.minimumSoldWithCogs', value: 5, type: 'number', category: 'finance', description: 'Minimum sold items with COGS per category for profit display' },

  // ── Cost Trends (Financial Center Canonical v3.0 §6.7) ────────────────
  { key: 'finance.costTrend.minimumHistoryMonths', value: 3, type: 'number', category: 'finance', description: 'Minimum months of expense data for cost trend analysis' },
  { key: 'finance.costTrend.minimumCategoryAmountCents', value: 5000, type: 'cents', category: 'finance', description: 'Minimum category total ($50) to include in cost trends' },
  { key: 'finance.costTrend.redAlertPct', value: 50, type: 'number', category: 'finance', description: 'Cost trend % increase for red alert' },
  { key: 'finance.costTrend.yellowAlertPct', value: 20, type: 'number', category: 'finance', description: 'Cost trend % increase for yellow alert' },

  // ── Tax Features (Financial Center Canonical v3.0 §6.5, §6.6) ────────
  { key: 'finance.tax.estimatedRateLow', value: 25, type: 'number', category: 'finance', description: 'Estimated self-employment tax rate low bound (%)' },
  { key: 'finance.tax.estimatedRateHigh', value: 30, type: 'number', category: 'finance', description: 'Estimated self-employment tax rate high bound (%)' },
  { key: 'finance.tax.q1DueDate', value: '2026-04-15', type: 'string', category: 'finance', description: 'Q1 quarterly estimated tax due date' },
  { key: 'finance.tax.q2DueDate', value: '2026-06-16', type: 'string', category: 'finance', description: 'Q2 quarterly estimated tax due date' },
  { key: 'finance.tax.q3DueDate', value: '2026-09-15', type: 'string', category: 'finance', description: 'Q3 quarterly estimated tax due date' },
  { key: 'finance.tax.q4DueDate', value: '2027-01-15', type: 'string', category: 'finance', description: 'Q4 quarterly estimated tax due date' },
  { key: 'finance.tax.reminderBannerDaysBefore', value: 30, type: 'number', category: 'finance', description: 'Days before due date to show tax reminder banner' },
  { key: 'finance.tax.reminderEmailDaysBefore', value: [30, 7], type: 'array', category: 'finance', description: 'Days before due date to send tax reminder emails' },
];

// Operations settings (automation, bundles, boost, overage, auth, local, stripe, shipping, feature flags)
import { V32_SETTINGS_OPERATIONS } from './v32-settings-operations';
// Extended settings (commerce, fulfillment, trust, discovery, comms, privacy)
import { V32_EXTENDED_SETTINGS } from './v32-platform-settings-extended';
// AI auto-fill settings (G1.1)
import { AI_AUTOFILL_SETTINGS } from './seed-ai-autofill';
// Affiliate & trial settings (G1.2)
import { AFFILIATE_TRIAL_SETTINGS } from './seed-affiliate-settings';
// Communications settings — comms.email.*, comms.push.*, comms.sms.*, comms.digest.*
import { COMMS_SETTINGS } from './seed-comms-settings';

/** @deprecated Use V32_PLATFORM_SETTINGS_CORE + V32_SETTINGS_OPERATIONS instead */
export const V32_PLATFORM_SETTINGS: PlatformSettingSeed[] = [
  ...V32_PLATFORM_SETTINGS_CORE,
  ...V32_SETTINGS_OPERATIONS,
];

export const V32_ALL_SETTINGS: PlatformSettingSeed[] = [
  ...V32_PLATFORM_SETTINGS,
  ...V32_EXTENDED_SETTINGS,
  ...AI_AUTOFILL_SETTINGS,
  ...AFFILIATE_TRIAL_SETTINGS,
  ...COMMS_SETTINGS,
];

// Total settings count for verification
export const V32_SETTINGS_COUNT = V32_ALL_SETTINGS.length;
