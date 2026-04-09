/**
 * v3.2 Platform Settings — Seller Score Engine
 * Score configuration, metric weights, rewards, and coaching tips.
 * Split from v32-platform-settings-extended.ts to stay under 300 lines.
 * (G4.1, Seller Score Canonical Section 11)
 */

import type { PlatformSettingSeed } from './v32-platform-settings';
import { V32_SCORE_THRESHOLD_SETTINGS } from './v32-platform-settings-score-thresholds';

export const V32_SCORE_ENGINE_SETTINGS: PlatformSettingSeed[] = [
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
  { key: 'trust.review.allowSellerResponse', value: true, type: 'boolean', category: 'trust', description: 'Allow sellers to respond to reviews' },
  { key: 'trust.review.moderationEnabled', value: true, type: 'boolean', category: 'trust', description: 'Enable review moderation' },
  { key: 'trust.review.editWindowHours', value: 24, type: 'number', category: 'trust', description: 'Hours to edit review after posting' },
  { key: 'trust.review.sellerResponseWindowDays', value: 30, type: 'number', category: 'trust', description: 'Days after review for seller to respond' },
  { key: 'trust.review.autoApproveAboveStars', value: 0, type: 'number', category: 'trust', description: 'Auto-approve reviews above X stars (0=all moderated) — canonical §10.3' },
  { key: 'trust.review.minLengthChars', value: 0, type: 'number', category: 'trust', description: 'Minimum review text length (0=none) — canonical §10.3' },
  { key: 'trust.review.maxLengthChars', value: 5000, type: 'number', category: 'trust', description: 'Maximum review text length — canonical §10.3' },
  { key: 'trust.standards.evaluationPeriodDays', value: 90, type: 'number', category: 'trust', description: 'Rolling window for seller standards evaluation' },
  { key: 'trust.standards.maxDefectRatePercent', value: 2, type: 'number', category: 'trust', description: 'Max transaction defect rate for GOOD standing' },
  { key: 'trust.standards.topRatedMinOrdersYear', value: 100, type: 'number', category: 'trust', description: 'Minimum annual orders for TOP_RATED' },
  { key: 'trust.standards.minOrdersForEvaluation', value: 10, type: 'number', category: 'trust', description: 'Minimum orders before standards evaluation applies' },
  { key: 'trust.standards.maxLateShipRatePercent', value: 4, type: 'number', category: 'trust', description: 'Max late shipment rate for GOOD standing (canonical §10.4)' },
  { key: 'trust.standards.maxUnresolvedCasesPercent', value: 0.3, type: 'number', category: 'trust', description: 'Max unresolved case rate for GOOD standing (canonical §10.4)' },
  { key: 'trust.standards.topRatedMaxDefectRate', value: 0.5, type: 'number', category: 'trust', description: 'Max defect rate for TOP_RATED' },
  { key: 'trust.standards.topRatedMaxLateShipRate', value: 1, type: 'number', category: 'trust', description: 'Max late ship rate for TOP_RATED' },
  { key: 'trust.standards.belowStandardVisibilityReduction', value: 50, type: 'number', category: 'trust', description: 'Search visibility reduction % for BELOW_STANDARD sellers' },
  { key: 'trust.standards.belowStandardTfSurcharge', value: 500, type: 'number', category: 'trust', description: 'TF surcharge in bps for BELOW_STANDARD sellers (canonical §10.4 — 5.0%)' },
  { key: 'trust.standards.restrictedMaxListings', value: 10, type: 'number', category: 'trust', description: 'Max active listings for RESTRICTED sellers' },
  { key: 'trust.standards.defectExpiryDays', value: 365, type: 'number', category: 'trust', description: 'Days after which a defect no longer counts' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE BANDS — Seller score band thresholds
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'performance.band.powerSeller', value: 900, type: 'number', category: 'trust', description: 'Min score for POWER_SELLER band' },
  { key: 'performance.band.topRated', value: 750, type: 'number', category: 'trust', description: 'Min score for TOP_RATED band' },
  { key: 'performance.band.established', value: 550, type: 'number', category: 'trust', description: 'Min score for ESTABLISHED band' },

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
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'score.smoothingFactor', value: 30, type: 'number', category: 'trust', description: 'Bayesian smoothing factor (number of "ghost" orders at platform mean)' },
  { key: 'score.priorMean', value: 3.5, type: 'number', category: 'trust', description: 'Bayesian prior mean star rating — the "ghost" rating new sellers start with (out of 5.0)' },
  { key: 'score.trendModifierMax', value: 0.05, type: 'number', category: 'trust', description: 'Maximum trend modifier as a fraction (+/- 5%)' },
  { key: 'score.trendDampeningFactor', value: 0.5, type: 'number', category: 'trust', description: 'Dampening multiplier for score change percent (0.5 = half of actual change)' },
  { key: 'score.defaultReviewScore', value: 500, type: 'number', category: 'trust', description: 'Default review metric score (0-1000) for sellers with no reviews' },
  { key: 'score.defaultResponseTimeScore', value: 700, type: 'number', category: 'trust', description: 'Default response time metric score (0-1000) for sellers with no response data' },
  { key: 'score.recalcSchedule', value: '0 3 * * *', type: 'string', category: 'trust', description: 'Cron schedule for daily seller score recalculation (3 AM UTC)' },
  { key: 'score.platformMeanRecalcSchedule', value: '0 4 * * 0', type: 'string', category: 'trust', description: 'Cron schedule for weekly platform mean score recalculation (4 AM UTC Sunday)' },
  { key: 'score.newSellerOrderThreshold', value: 10, type: 'number', category: 'trust', description: 'Minimum completed orders before a seller receives a performance score' },
  { key: 'score.transitionOrderThreshold', value: 50, type: 'number', category: 'trust', description: 'Orders before search multiplier is fully unlocked (no longer clamped to 0.95-1.10)' },
  { key: 'score.downgradeGraceDays', value: 7, type: 'number', category: 'trust', description: 'Consecutive days below threshold before band downgrade is applied' },

  // Metric Weights (Section 11.3) — must sum to 1.0
  { key: 'score.weight.onTimeShipping', value: 0.25, type: 'number', category: 'trust', description: 'Weight for on-time shipping metric in score calculation' },
  { key: 'score.weight.inadRate', value: 0.20, type: 'number', category: 'trust', description: 'Weight for INAD claim rate metric in score calculation' },
  { key: 'score.weight.reviewAverage', value: 0.20, type: 'number', category: 'trust', description: 'Weight for review average metric in score calculation' },
  { key: 'score.weight.responseTime', value: 0.15, type: 'number', category: 'trust', description: 'Weight for response time metric in score calculation' },
  { key: 'score.weight.returnRate', value: 0.10, type: 'number', category: 'trust', description: 'Weight for return rate metric in score calculation' },
  { key: 'score.weight.cancellationRate', value: 0.10, type: 'number', category: 'trust', description: 'Weight for cancellation rate metric in score calculation' },

  // Category-Adjusted Thresholds (Section 11.4) — see v32-platform-settings-score-thresholds.ts
  ...V32_SCORE_THRESHOLD_SETTINGS,

  // Reward Configuration (Section 11.6)
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
];
