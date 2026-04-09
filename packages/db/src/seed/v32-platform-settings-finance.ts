/**
 * v3.2 Platform Settings — Finance & Score sub-section
 * Finance pricing, receipt scanning, intelligence data gates, health score,
 * performing periods, capital efficiency, tax features.
 * Split from v32-platform-settings.ts to stay under 300 lines.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const V32_FINANCE_SETTINGS: PlatformSettingSeed[] = [
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
