/** Human-friendly labels and display formatting for platform settings */

const L: Record<string, string> = {
  'general.siteName': 'Site Name',
  'general.supportEmail': 'Support Email',
  'general.siteDescription': 'Site Description',
  'general.maintenanceMode': 'Maintenance Mode',
  'general.registrationEnabled': 'User Registration',
  'general.sellerRegistrationEnabled': 'Seller Registration',
  'general.defaultCurrency': 'Default Currency',
  'general.minListingPriceCents': 'Minimum Listing Price',
  'general.maxListingPriceCents': 'Maximum Listing Price',
  'general.staffInactivityTimeoutMinutes': 'Staff Inactivity Timeout',
  'general.userInactivityTimeoutMinutes': 'User Inactivity Timeout',
  'general.userSessionMaxDays': 'Max Session Lifetime',
  'commerce.tf.bracket1.maxCents': 'Bracket 1 — Ceiling',
  'commerce.tf.bracket1.rate': 'Bracket 1 — TF Rate',
  'commerce.tf.bracket2.maxCents': 'Bracket 2 — Ceiling',
  'commerce.tf.bracket2.rate': 'Bracket 2 — TF Rate',
  'commerce.tf.bracket3.maxCents': 'Bracket 3 — Ceiling',
  'commerce.tf.bracket3.rate': 'Bracket 3 — TF Rate',
  'commerce.tf.bracket4.maxCents': 'Bracket 4 — Ceiling',
  'commerce.tf.bracket4.rate': 'Bracket 4 — TF Rate',
  'commerce.tf.bracket5.maxCents': 'Bracket 5 — Ceiling',
  'commerce.tf.bracket5.rate': 'Bracket 5 — TF Rate',
  'commerce.tf.bracket6.maxCents': 'Bracket 6 — Ceiling',
  'commerce.tf.bracket6.rate': 'Bracket 6 — TF Rate',
  'commerce.tf.bracket7.maxCents': 'Bracket 7 — Ceiling',
  'commerce.tf.bracket7.rate': 'Bracket 7 — TF Rate',
  'commerce.tf.bracket8.maxCents': 'Bracket 8 — Ceiling',
  'commerce.tf.bracket8.rate': 'Bracket 8 — TF Rate',
  'commerce.tf.minimumCents': 'Minimum TF Per Order',
  'commerce.tf.gmvWindowType': 'GMV Window Type',
  'commerce.escrow.holdHours': 'Escrow Hold Period',
  'commerce.dispute.reviewDeadlineHours': 'Dispute Review Deadline',
  'commerce.escrow.autoReleaseEnabled': 'Auto-Release After Hold',
  'commerce.escrow.buyerEarlyAcceptEnabled': 'Buyer Early Accept',
  'payout.weeklyDay': 'Weekly Payout Day',
  'payout.weeklyTime': 'Weekly Payout Time (UTC)',
  'payout.dailyTime': 'Daily Payout Time (UTC)',
  'payout.minimumNoneCents': 'Min Payout — Free Tier',
  'payout.minimumStarterCents': 'Min Payout — Starter',
  'payout.minimumProCents': 'Min Payout — Pro',
  'payout.minimumPowerCents': 'Min Payout — Power',
  'payout.minimumEnterpriseCents': 'Min Payout — Enterprise',
  'payout.instantFeeCents': 'Instant Payout Fee',
  'payout.dailyFeeCents': 'Daily Payout Fee',
  'payout.instantMaxCents': 'Max Instant Payout',
  'payout.instantEnabled': 'Instant Payouts',
  'payout.onPlatformFeePaymentEnabled': 'Pay Fees from Earnings',
  'store.pricing.starter.annualCents': 'Store Starter — Annual',
  'store.pricing.starter.monthlyCents': 'Store Starter — Monthly',
  'store.pricing.pro.annualCents': 'Store Pro — Annual',
  'store.pricing.pro.monthlyCents': 'Store Pro — Monthly',
  'store.pricing.power.annualCents': 'Store Power — Annual',
  'store.pricing.power.monthlyCents': 'Store Power — Monthly',
  'fees.insertion.NONE': 'Insertion Fee — Free Tier',
  'fees.insertion.STARTER': 'Insertion Fee — Starter',
  'fees.insertion.PRO': 'Insertion Fee — Pro',
  'fees.insertion.POWER': 'Insertion Fee — Power',
  'fees.insertion.ENTERPRISE': 'Insertion Fee — Enterprise',
  'fees.freeListings.NONE': 'Free Listings/mo — Free Tier',
  'fees.freeListings.STARTER': 'Free Listings/mo — Starter',
  'fees.freeListings.PRO': 'Free Listings/mo — Pro',
  'fees.freeListings.POWER': 'Free Listings/mo — Power',
  'fees.freeListings.ENTERPRISE': 'Free Listings/mo — Enterprise',
  'crosslister.pricing.lite.annualCents': 'Crosslister Lite — Annual',
  'crosslister.pricing.lite.monthlyCents': 'Crosslister Lite — Monthly',
  'crosslister.pricing.pro.annualCents': 'Crosslister Pro — Annual',
  'crosslister.pricing.pro.monthlyCents': 'Crosslister Pro — Monthly',
  'crosslister.publishes.FREE': 'Publishes/mo — Free Tier',
  'crosslister.publishes.LITE': 'Publishes/mo — Lite',
  'crosslister.publishes.PRO': 'Publishes/mo — Pro',
  'crosslister.aiCredits.LITE': 'AI Credits/mo — Lite',
  'crosslister.aiCredits.PRO': 'AI Credits/mo — Pro',
  'crosslister.bgRemovals.LITE': 'BG Removals/mo — Lite',
  'crosslister.bgRemovals.PRO': 'BG Removals/mo — Pro',
  'crosslister.rolloverDays': 'Credit Rollover Window',
  'crosslister.rolloverMaxMultiplier': 'Max Rollover Multiplier',
  'finance.pricing.pro.annualCents': 'Finance Pro — Annual',
  'finance.pricing.pro.monthlyCents': 'Finance Pro — Monthly',
  'finance.trialMonths.bundlePromo': 'Bundle Promo Trial',
  'finance.foldThreshold': 'Finance Fold Threshold',
  'finance.mileageRatePerMile': 'Mileage Rate ($/mile)',
  'automation.pricing.annualCents': 'Automation — Annual',
  'automation.pricing.monthlyCents': 'Automation — Monthly',
  'automation.actionsPerMonth': 'Actions Included/mo',
  'automation.overagePackSize': 'Overage Pack Size',
  'automation.overagePackCents': 'Overage Pack Price',
  'bundle.starter.annualCents': 'Starter Bundle — Annual',
  'bundle.starter.monthlyCents': 'Starter Bundle — Monthly',
  'bundle.pro.annualCents': 'Pro Bundle — Annual',
  'bundle.pro.monthlyCents': 'Pro Bundle — Monthly',
  'bundle.power.annualCents': 'Power Bundle — Annual',
  'bundle.power.monthlyCents': 'Power Bundle — Monthly',
  'boost.minRateBps': 'Min Boost Rate',
  'boost.maxRateBps': 'Max Boost Rate',
  'boost.attributionDays': 'Boost Attribution Window',
  'boost.maxPromotedPercentBps': 'Max Promoted Results',
  'boost.refundOnReturn': 'Refund Boost on Return',
  'boost.minimumStoreTier': 'Min Store Tier for Boost',
  'overage.publishes.qty': 'Publish Pack — Quantity',
  'overage.publishes.cents': 'Publish Pack — Price',
  'overage.aiCredits.qty': 'AI Credits Pack — Quantity',
  'overage.aiCredits.cents': 'AI Credits Pack — Price',
  'overage.bgRemovals.qty': 'BG Removals Pack — Quantity',
  'overage.bgRemovals.cents': 'BG Removals Pack — Price',
  'overage.automation.qty': 'Automation Pack — Quantity',
  'overage.automation.cents': 'Automation Pack — Price',
  'auth.buyerFeeCents': 'Buyer Authentication Fee',
  'auth.sellerFeeCents': 'Seller Authentication Fee',
  'auth.expertFeeCents': 'Expert Authentication Fee',
  'commerce.local.confirmationCodeExpiryHours': 'QR Code Expiry',
  'commerce.local.noShowFeeCents': 'No-Show Fee',
  'commerce.local.noShowStrikeLimit': 'No-Show Strike Limit',
  'commerce.local.noShowSuspensionDays': 'No-Show Suspension',
  'commerce.local.meetupAutoCancelMinutes': 'Meetup Auto-Cancel',
  'commerce.local.offlineGraceHours': 'Offline Grace Period',
  'commerce.local.claimWindowDays': 'Local Claim Window',
  'commerce.local.defaultRadiusMiles': 'Default Search Radius',
  'commerce.local.maxRadiusMiles': 'Max Search Radius',
  'stripe.activeAccountFeeCents': 'Active Account Fee',
  'stripe.payoutFixedCents': 'Payout Fixed Fee',
  'stripe.payoutPercentBps': 'Payout Percentage',
  'stripe.fundsRoutingBps': 'Funds Routing Fee',
  'stripe.instantPayoutBps': 'Instant Payout Rate',
  'stripe.subscriptionBillingBps': 'Subscription Billing',
  'stripe.irsEfileCents': 'IRS E-File Fee',
  'stripe.stateEfileCents': 'State E-File Fee',
  'commerce.stripe.processingRateBps': 'Processing Rate',
  'commerce.stripe.processingFixedCents': 'Processing Fixed Fee',
  'commerce.shipping.combinedQuoteDeadlineHours': 'Combined Quote Deadline',
  'commerce.shipping.combinedPenaltyDiscountPercent': 'Penalty Discount',
  'commerce.shipping.autoDiscountMinPercent': 'Auto-Discount Min',
  'commerce.shipping.autoDiscountMaxPercent': 'Auto-Discount Max',
  'commerce.shipping.lostInTransitDays': 'Lost In Transit Threshold',
  'commerce.shipping.significantDelayDays': 'Significant Delay Threshold',
  'commerce.returns.estimatedShippingCents': 'Est. Return Shipping Cost',
  'featureFlags.cacheSeconds': 'Flag Cache TTL',
  'featureFlags.requireApprovalForProduction': 'Require Prod Approval',
  'cart.expiryHours': 'Cart Expiry',
  'cart.maxItems': 'Max Cart Items',
  'cart.reservationMinutes': 'Cart Reservation Hold',
  'cart.guestCheckoutEnabled': 'Guest Checkout',
  'offer.enabled': 'Offers Feature',
  'offer.expirationHours': 'Offer Expiry',
  'offer.minPercentOfAsking': 'Min Offer % of Asking',
  'offer.counterOfferEnabled': 'Counter Offers',
  'offer.maxOffersPerBuyer': 'Max Offers Per Buyer',
  'offer.autoDeclineBelowMin': 'Auto-Decline Low Offers',
  'bundle.enabled': 'Bundles Feature',
  'bundle.maxPerSeller': 'Max Bundles Per Seller',
  'bundle.maxDiscountPercent': 'Max Bundle Discount',
  'bundle.minItems': 'Min Bundle Items',
  'order.autoCompleteAfterDays': 'Auto-Complete Orders After',
  'order.buyerCancelWindowHours': 'Buyer Cancel Window',
  'order.maxItemsPerOrder': 'Max Items Per Order',
  'listing.maxImagesPerListing': 'Max Photos Per Listing',
  'listing.minTitleLength': 'Min Title Length',
  'listing.maxTitleLength': 'Max Title Length',
  'listing.durationDays': 'Default Listing Duration',
  'listing.autoRenewEnabled': 'Auto-Renew Listings',
  'cancellation.buyerWindowHours': 'Buyer Cancel Window',
  'cancellation.sellerPenaltyEnabled': 'Seller Cancel Penalty',
  'cancellation.autoRefundOnCancel': 'Auto-Refund on Cancel',
  'shipping.defaultHandlingDays': 'Default Handling Time',
  'shipping.maxHandlingDays': 'Max Handling Time',
  'shipping.trackingRequiredAboveCents': 'Tracking Required Above',
  'shipping.signatureRequiredAboveCents': 'Signature Required Above',
  'shipping.defaultCarrier': 'Default Carrier',
  'shipping.labelGenerationEnabled': 'Shipping Label Generation',
  'insurance.autoInsureAboveCents': 'Auto-Insure Above',
  'returns.windowDays': 'Return Window',
  'returns.restockingFeeBps': 'Restocking Fee',
  'payout.newSellerHoldDays': 'New Seller Payout Hold',
  'payout.highRiskHoldEnabled': 'High-Risk Payout Hold',
  'trust.baseScore': 'Base Trust Score',
  'trust.bandExcellentMin': 'Excellent Band Minimum',
  'trust.bandGoodMin': 'Good Band Minimum',
  'trust.bandWatchMin': 'Watch Band Minimum',
  'trust.decayHalfLifeDays': 'Score Decay Half-Life',
  'trust.event.review5Star': '5-Star Review Impact',
  'trust.event.lateShipment': 'Late Shipment Impact',
  'trust.event.sellerCancel': 'Seller Cancel Impact',
  'trust.event.chargeback': 'Chargeback Impact',
  'trust.event.policyViolation': 'Policy Violation Impact',
  'trust.review.eligibleDaysAfterDelivery': 'Review Eligibility Delay',
  'trust.review.windowDays': 'Review Window',
  'review.allowSellerResponse': 'Seller Review Responses',
  'review.moderationEnabled': 'Review Moderation',
  'trust.review.editWindowHours': 'Review Edit Window',
  'standards.evaluationPeriodDays': 'Standards Eval Period',
  'standards.maxDefectRatePercent': 'Max Defect Rate',
  'standards.topRatedMinOrdersYear': 'Top Rated Min Orders/Year',
  'search.titleWeight': 'Title Match Weight',
  'search.descriptionWeight': 'Description Match Weight',
  'search.trustMultiplierEnabled': 'Trust Ranking Boost',
  'search.freshnessBoostEnabled': 'Freshness Ranking Boost',
  'search.defaultPageSize': 'Results Per Page',
  'promo.boostEnabled': 'Promoted Listings',
  'promo.maxBoostMultiplier': 'Max Promotion Boost',
  'priceAlert.enabled': 'Price Drop Alerts',
  'priceAlert.maxPerUser': 'Max Alerts Per User',
  'marketIndex.enabled': 'Market Price Index',
  'marketIndex.dealBadgesEnabled': 'Great Deal Badges',
  'email.enabled': 'Email Notifications',
  'email.maxPerDayPerUser': 'Email Rate Limit',
  'email.marketingEnabled': 'Marketing Emails',
  'push.enabled': 'Push Notifications',
  'sms.enabled': 'SMS Notifications',
  'digest.enabled': 'Email Digest',
  'digest.frequency': 'Digest Frequency',
  'messaging.enabled': 'Direct Messaging',
  'messaging.rateLimitPerHour': 'Message Rate Limit',
  'messaging.moderationEnabled': 'Message Moderation',
  'retention.messageDays': 'Message Retention',
  'retention.searchLogDays': 'Search Log Retention',
  'retention.auditLogDays': 'Audit Log Retention',
  'gdpr.dataExportEnabled': 'Data Export (GDPR)',
  'gdpr.deletionGracePeriodDays': 'Deletion Grace Period',
  'gdpr.anonymizeOnDeletion': 'Anonymize on Deletion',
  'gdpr.cookieConsentRequired': 'Cookie Consent Required',
  'audit.retentionMonths': 'Audit Retention (months)',
  'audit.archiveBeforePurge': 'Archive Audit Events Before Purge',
  'privacy.orderRetentionYears': 'Order Data Retention (years)',
  'privacy.granularAnalyticsRetentionDays': 'Granular Analytics Retention (days)',
};

export function getLabel(key: string): string {
  return L[key] ?? key;
}

function effectiveType(type: string, key: string): string {
  if (type === 'cents' || type === 'bps') return type;
  if (/Cents$/i.test(key) || key.endsWith('.cents')) return 'cents';
  if (/Bps$/i.test(key)) return 'bps';
  return type;
}

export function getUnit(key: string): string | null {
  const k = key.toLowerCase();
  if (k.endsWith('hours')) return 'hours';
  if (k.endsWith('days')) return 'days';
  if (k.endsWith('minutes')) return 'min';
  if (k.endsWith('miles')) return 'miles';
  if (k.endsWith('seconds')) return 'sec';
  if (k.endsWith('percent')) return '%';
  return null;
}

export function formatValue(value: unknown, type: string, key: string): string {
  const et = effectiveType(type, key);
  const n = Number(value);
  if (et === 'cents') return `$${(n / 100).toFixed(2)}`;
  if (et === 'bps') return `${(n / 100).toFixed(1)}%`;
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  const unit = getUnit(key);
  if (unit && !isNaN(n)) return `${n.toLocaleString()} ${unit}`;
  return String(value ?? '');
}

export function toInputValue(value: unknown, type: string, key: string): string {
  const et = effectiveType(type, key);
  const n = Number(value);
  if (et === 'cents') return (n / 100).toFixed(2);
  if (et === 'bps') return (n / 100).toFixed(1);
  return String(value ?? '');
}

export function fromInputValue(input: string, type: string, key: string): unknown {
  const et = effectiveType(type, key);
  if (et === 'cents') return Math.round(parseFloat(input || '0') * 100);
  if (et === 'bps') return Math.round(parseFloat(input || '0') * 100);
  if (type === 'number') return Number(input);
  return input;
}

export function getInputPrefix(type: string, key: string): string | null {
  return effectiveType(type, key) === 'cents' ? '$' : null;
}

export function getInputSuffix(type: string, key: string): string | null {
  const et = effectiveType(type, key);
  if (et === 'bps') return '%';
  return getUnit(key);
}
