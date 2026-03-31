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

export const V32_PLATFORM_SETTINGS: PlatformSettingSeed[] = [
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCE PRICING (Financial Center Canonical v3.0 §2)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'finance.pricing.pro.annualMonthlyCents', value: 1199, type: 'cents', category: 'finance', description: 'Finance Pro annual price/mo ($11.99)' },
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
  { key: 'commerce.returns.estimatedShippingCents', value: 800, type: 'number', category: 'commerce.returns', description: 'Estimated return shipping cost in cents' },
  { key: 'commerce.returns.sellerResponseDeadlineDays', value: 3, type: 'number', category: 'commerce.returns', description: 'Business days seller has to respond to a return request' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS (E4)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'featureFlags.cacheSeconds', value: 30, type: 'number', category: 'featureFlags', description: 'Valkey cache TTL in seconds for feature flag values' },
  { key: 'featureFlags.requireApprovalForProduction', value: false, type: 'boolean', category: 'featureFlags', description: 'Require 2-person approval for production flag changes' },
];

// Extended settings (commerce, fulfillment, trust, discovery, comms, privacy)
import { V32_EXTENDED_SETTINGS } from './v32-platform-settings-extended';
// AI auto-fill settings (G1.1)
import { AI_AUTOFILL_SETTINGS } from './seed-ai-autofill';
// Affiliate & trial settings (G1.2)
import { AFFILIATE_TRIAL_SETTINGS } from './seed-affiliate-settings';

export const V32_ALL_SETTINGS: PlatformSettingSeed[] = [
  ...V32_PLATFORM_SETTINGS,
  ...V32_EXTENDED_SETTINGS,
  ...AI_AUTOFILL_SETTINGS,
  ...AFFILIATE_TRIAL_SETTINGS,
];

// Total settings count for verification
export const V32_SETTINGS_COUNT = V32_ALL_SETTINGS.length;
