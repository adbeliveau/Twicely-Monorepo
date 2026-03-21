/**
 * Detailed help text for the ? tooltip on platform settings.
 * Only settings that need extra context are listed here.
 * The DB description is shown as subtitle; this is the deeper explanation.
 */

const H: Record<string, string> = {
  // General
  'general.maintenanceMode': 'When enabled, all public pages show a maintenance screen. Staff hub remains accessible. Use during deployments or emergencies. Sellers cannot list, buyers cannot purchase.',
  'general.registrationEnabled': 'Controls whether the Sign Up button is visible and functional. Disabling this blocks all new account creation but does not affect existing users.',
  'general.sellerRegistrationEnabled': 'Controls whether users can activate seller mode. When disabled, existing sellers keep their accounts but new users cannot become sellers.',
  'general.minListingPriceCents': 'The lowest price a seller can set for any listing. Prevents spam listings and ensures transaction fees cover processing costs.',
  'general.maxListingPriceCents': 'The highest price allowed for a single listing. Protects against accidental overpricing. Contact Enterprise sellers for higher limits.',
  'general.staffInactivityTimeoutMinutes': 'Staff sessions are automatically logged out after this many minutes of no activity. Short timeouts improve security for admin accounts.',
  'general.userInactivityTimeoutMinutes': 'Regular user sessions are logged out after this many minutes idle. Set higher than staff timeout for better buyer/seller experience.',
  'general.userSessionMaxDays': 'Maximum session lifetime regardless of activity. After this many days, the user must log in again even if they were active.',

  // Payout
  'payout.weeklyDay': 'Day of the week for automatic weekly payouts (1=Monday, 5=Friday, 7=Sunday). Only applies to BUSINESS sellers with weekly auto-payout enabled.',
  'payout.instantFeeCents': 'Flat fee charged per instant payout request. Covers Stripe instant transfer costs. Deducted from the payout amount before sending.',
  'payout.dailyFeeCents': 'Flat fee for daily auto-payout. Only available to POWER tier and above. Deducted from each daily payout transfer.',
  'payout.instantMaxCents': 'Maximum single instant payout amount. Larger amounts must use standard payout. Protects against fraud on newly compromised accounts.',
  'payout.onPlatformFeePaymentEnabled': 'Allows sellers to pay platform fees (insertion fees, subscription) from their available-for-payout earnings instead of their external payment method.',

  // Crosslister
  'crosslister.rolloverDays': 'Unused monthly credits (publishes, AI, BG removals) expire after this many days. Credits earned in January expire in March if set to 60 days.',
  'crosslister.rolloverMaxMultiplier': 'Maximum accumulated credits as a multiple of the monthly allowance. At 3x, a user with 200/mo can hold at most 600 credits.',

  // Finance
  'finance.trialMonths.bundlePromo': 'Months of free Finance Pro included when a seller purchases a subscription bundle (Store + Crosslister combo).',
  'finance.foldThreshold': 'If Finance Pro conversion drops below this percentage, the product may be folded into Store subscriptions as a free feature.',
  'finance.mileageRatePerMile': 'IRS standard mileage rate used in the Finance Pro mileage tracker for tax deduction estimates. Update annually when the IRS publishes new rates.',

  // Automation
  'automation.actionsPerMonth': 'Number of automation actions included per month with the Automation add-on. Actions include scheduled repricings, bulk edits, and workflow triggers.',
  'automation.overagePackSize': 'Number of additional actions in each overage pack. Sellers purchase packs on demand when they exceed their monthly included actions.',

  // Commerce
  'cart.expiryHours': 'Items automatically removed from cart after this many hours. Prevents indefinite holds on inventory. The seller\'s listing becomes available again.',
  'cart.reservationMinutes': 'Once added to cart, the item is held exclusively for this buyer for X minutes. Other buyers see "In someone\'s cart" during this window.',
  'offer.minPercentOfAsking': 'Offers below this percentage of the listing price are blocked. Prevents lowball spam. Example: at 50%, a $100 item requires at least a $50 offer.',
  'offer.autoDeclineBelowMin': 'When enabled, offers below the seller\'s configured minimum auto-accept price are automatically rejected without notifying the seller.',
  'order.autoCompleteAfterDays': 'Orders automatically marked as completed this many days after delivery confirmation, if the buyer has not filed a claim or requested a return.',
  'listing.durationDays': 'Listings automatically expire after this many days. Sellers can manually renew or enable auto-renew. Expired listings are hidden from search.',

  // Escrow
  'commerce.escrow.holdHours': 'After delivery is confirmed, funds are held for this many hours before becoming available for payout. Gives the buyer time to inspect the item.',
  'commerce.dispute.reviewDeadlineHours': 'Staff must review and respond to a dispute within this window. If exceeded, the dispute auto-escalates to a senior reviewer.',
  'commerce.escrow.buyerEarlyAcceptEnabled': 'Allows buyers to release funds early by confirming they are satisfied before the escrow hold period expires.',

  // Local
  'commerce.local.noShowFeeCents': 'Fee charged to the party who fails to show up at an agreed meetup. Deducted from seller earnings or charged to buyer\'s payment method.',
  'commerce.local.noShowStrikeLimit': 'After this many no-shows within 90 days, the user is suspended from local transactions for the suspension period below.',
  'commerce.local.meetupAutoCancelMinutes': 'If one party checks in at the meetup location but the other does not arrive within this window, the transaction is auto-cancelled.',

  // Shipping
  'shipping.trackingRequiredAboveCents': 'Orders above this amount require the seller to provide a tracking number. Below this amount, tracking is optional but recommended.',
  'shipping.signatureRequiredAboveCents': 'Orders above this amount require signature confirmation on delivery. Protects high-value shipments from "not received" claims.',
  'commerce.shipping.combinedQuoteDeadlineHours': 'When a buyer purchases multiple items from the same seller, the seller has this many hours to provide a combined shipping quote.',
  'commerce.shipping.combinedPenaltyDiscountPercent': 'If a seller misses the combined shipping quote deadline, this percentage discount is automatically applied to the shipping total.',

  // Trust
  'trust.baseScore': 'Every new seller starts at this score. Score changes up or down based on transaction outcomes. Used for search ranking and badge display.',
  'trust.decayHalfLifeDays': 'Negative events lose half their impact on the trust score after this many days. Allows sellers to recover from past issues over time.',
  'trust.event.chargeback': 'Points deducted from trust score when a buyer files a chargeback through their bank. Chargebacks are the most severe negative signal.',
  'standards.maxDefectRatePercent': 'Maximum percentage of transactions with defects (returns, claims, cancellations) allowed to maintain GOOD standing in seller standards.',
  'standards.topRatedMinOrdersYear': 'Minimum completed orders in the past 12 months required to qualify for TOP_RATED seller band, in addition to score thresholds.',

  // Search
  'search.titleWeight': 'Relative importance of title keyword matches vs description matches in search ranking. Higher values prioritize title matches more heavily.',
  'boost.maxPromotedPercentBps': 'Maximum percentage of search results that can be promoted listings (stored as basis points: 3000 = 30%). Ensures organic results are never fully displaced. Capped at 30% per spec.',
  'boost.refundOnReturn': 'When enabled, boost fees are refunded if the promoted sale results in a return or refund. Prevents charging sellers for unsuccessful transactions.',

  // Privacy
  'retention.auditLogDays': 'Audit logs must be retained for 7 years (2,555 days) for financial compliance. Reducing this value may violate regulatory requirements.',
  'gdpr.deletionGracePeriodDays': 'Days between a user requesting account deletion and permanent data removal. During this window, the user can cancel the deletion request.',
  'gdpr.anonymizeOnDeletion': 'When enabled, user data is anonymized (names, emails replaced with hashes) rather than hard-deleted. Preserves transaction integrity for accounting.',
};

export function getHelpText(key: string): string | null {
  return H[key] ?? null;
}
