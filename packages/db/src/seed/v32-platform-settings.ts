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

];

// Finance pricing, intelligence, health score, tax — split for line limit
import { V32_FINANCE_SETTINGS } from './v32-platform-settings-finance';
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

export { V32_FINANCE_SETTINGS };
export { V32_SETTINGS_OPERATIONS };
export { V32_EXTENDED_SETTINGS };

/** @deprecated Use V32_PLATFORM_SETTINGS_CORE + V32_SETTINGS_OPERATIONS instead */
export const V32_PLATFORM_SETTINGS: PlatformSettingSeed[] = [
  ...V32_PLATFORM_SETTINGS_CORE,
  ...V32_FINANCE_SETTINGS,
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
