/**
 * Settings search index — 216+ searchable settings matching V2.
 * Used by SettingsSearch component.
 */
export interface SearchEntry {
  key: string;
  title: string;
  description: string;
  tabLabel: string;
  href: string;
}

function entry(key: string, title: string, desc: string, tab: string, href: string): SearchEntry {
  return { key, title, description: desc, tabLabel: tab, href };
}

const P = '/cfg/platform?tab=';

export const SEARCH_INDEX: SearchEntry[] = [
  // ── Sub-pages ──────────────────────────────────────────────────────────
  entry('page.settings', 'General Settings', 'Site name, registration, security', 'Settings Page', '/cfg'),
  entry('page.modules', 'Modules', 'Stripe, Shippo & platform integrations', 'Settings Page', '/cfg/modules'),
  entry('page.flags', 'Feature Flags', 'Control feature rollouts and A/B tests', 'Settings Page', '/flags'),
  entry('page.trust', 'Trust & Safety Settings', 'Moderation and trust configuration', 'Settings Page', '/cfg/trust'),
  entry('page.notifications', 'Notifications', 'Email and push notification templates', 'Settings Page', '/cfg/notifications'),
  entry('page.monetization', 'Monetization', 'Platform fees, payouts & pricing', 'Settings Page', '/cfg/monetization'),
  entry('page.stripe', 'Stripe Payments', 'Payment processing configuration', 'Settings Page', '/cfg/stripe'),
  entry('page.shippo', 'Shippo Shipping', 'Shipping labels and carriers', 'Settings Page', '/cfg/shippo'),
  entry('page.providers', 'Providers', 'Service adapters and instances', 'Settings Page', '/cfg/providers'),
  entry('page.environment', 'Environment', 'API keys, secrets, infrastructure', 'Settings Page', '/cfg/environment'),
  entry('page.platform', 'Platform Config', '216+ configurable settings', 'Settings Page', '/cfg/platform'),

  // ── Main page inline settings ──────────────────────────────────────────
  entry('siteName', 'Site Name', 'Platform name displayed to users', 'General Settings', '/cfg'),
  entry('supportEmail', 'Support Email', 'Support contact email address', 'General Settings', '/cfg'),
  entry('siteDescription', 'Site Description', 'Platform description', 'General Settings', '/cfg'),
  entry('maintenanceMode', 'Maintenance Mode', 'Disable public access to the platform', 'General Settings', '/cfg'),
  entry('registrationEnabled', 'User Registration', 'Allow new users to register', 'General Settings', '/cfg'),
  entry('sellerRegistrationEnabled', 'Seller Registration', 'Allow users to become sellers', 'General Settings', '/cfg'),
  entry('staffInactivityTimeout', 'Staff Inactivity Timeout', 'Staff session sign out timer', 'General Settings', '/cfg'),
  entry('userInactivityTimeout', 'User Inactivity Timeout', 'User session sign out timer', 'General Settings', '/cfg'),
  entry('userSessionMaxDays', 'User Session Max Days', 'Maximum session lifetime for users', 'General Settings', '/cfg'),
  entry('defaultCurrency', 'Default Currency', 'Default currency for the platform', 'General Settings', '/cfg'),
  entry('minListingPrice', 'Min Listing Price', 'Minimum price sellers can set', 'General Settings', '/cfg'),
  entry('maxListingPrice', 'Max Listing Price', 'Maximum price sellers can set', 'General Settings', '/cfg'),

  // ── Fees & Pricing ─────────────────────────────────────────────────────
  entry('commerce.tf.bracket1.rate', 'TF Bracket 1 Rate', 'Transaction fee rate 10%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket2.rate', 'TF Bracket 2 Rate', 'Transaction fee rate 11%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket3.rate', 'TF Bracket 3 Rate', 'Transaction fee rate 10.5%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket4.rate', 'TF Bracket 4 Rate', 'Transaction fee rate 10%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket5.rate', 'TF Bracket 5 Rate', 'Transaction fee rate 9.5%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket6.rate', 'TF Bracket 6 Rate', 'Transaction fee rate 9%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket7.rate', 'TF Bracket 7 Rate', 'Transaction fee rate 8.5%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.bracket8.rate', 'TF Bracket 8 Rate', 'Transaction fee rate 8%', 'Fees & Pricing', `${P}fees`),
  entry('commerce.tf.minimumCents', 'Minimum TF', 'Minimum transaction fee per order', 'Fees & Pricing', `${P}fees`),
  entry('fees.insertion.NONE', 'Insertion Fee NONE', 'Insertion fee for free tier', 'Fees & Pricing', `${P}fees`),
  entry('fees.insertion.STARTER', 'Insertion Fee STARTER', 'Insertion fee for starter tier', 'Fees & Pricing', `${P}fees`),
  entry('fees.insertion.PRO', 'Insertion Fee PRO', 'Insertion fee for pro tier', 'Fees & Pricing', `${P}fees`),
  entry('fees.insertion.POWER', 'Insertion Fee POWER', 'Insertion fee for power tier', 'Fees & Pricing', `${P}fees`),
  entry('fees.insertion.ENTERPRISE', 'Insertion Fee ENTERPRISE', 'Insertion fee for enterprise', 'Fees & Pricing', `${P}fees`),
  entry('fees.freeListings.NONE', 'Free Listings NONE', 'Free listings per month free tier', 'Fees & Pricing', `${P}fees`),
  entry('fees.freeListings.STARTER', 'Free Listings STARTER', 'Free listings per month starter', 'Fees & Pricing', `${P}fees`),
  entry('fees.freeListings.PRO', 'Free Listings PRO', 'Free listings per month pro', 'Fees & Pricing', `${P}fees`),
  entry('fees.freeListings.POWER', 'Free Listings POWER', 'Free listings per month power', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.starter.annualCents', 'Store Starter Annual', 'Monthly price on annual plan', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.starter.monthlyCents', 'Store Starter Monthly', 'Monthly price', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.pro.annualCents', 'Store Pro Annual', 'Monthly price on annual plan', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.pro.monthlyCents', 'Store Pro Monthly', 'Monthly price', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.power.annualCents', 'Store Power Annual', 'Monthly price on annual plan', 'Fees & Pricing', `${P}fees`),
  entry('store.pricing.power.monthlyCents', 'Store Power Monthly', 'Monthly price', 'Fees & Pricing', `${P}fees`),

  // ── Commerce ───────────────────────────────────────────────────────────
  entry('cart.expiryHours', 'Cart Expiry Hours', 'Cart items expire after this many hours', 'Commerce', `${P}commerce`),
  entry('cart.maxItems', 'Max Cart Items', 'Maximum items allowed in cart', 'Commerce', `${P}commerce`),
  entry('cart.reservationMinutes', 'Item Reservation Minutes', 'Hold item in cart before releasing', 'Commerce', `${P}commerce`),
  entry('cart.guestCheckoutEnabled', 'Guest Checkout', 'Allow checkout without account', 'Commerce', `${P}commerce`),
  entry('offer.enabled', 'Best Offer Enabled', 'Enable Make Offer feature globally', 'Commerce', `${P}commerce`),
  entry('offer.expirationHours', 'Offer Expiration Hours', 'Offers expire after X hours', 'Commerce', `${P}commerce`),
  entry('offer.minPercentOfAsking', 'Minimum Offer Percentage', 'Minimum offer as % of asking price', 'Commerce', `${P}commerce`),
  entry('offer.counterOfferEnabled', 'Counter-Offers Enabled', 'Allow sellers to counter buyer offers', 'Commerce', `${P}commerce`),
  entry('offer.maxOffersPerBuyer', 'Max Offers Per Buyer', 'Max offers per buyer per listing', 'Commerce', `${P}commerce`),
  entry('offer.autoDeclineBelowMin', 'Auto-Decline Below Minimum', 'Auto-reject offers below minimum', 'Commerce', `${P}commerce`),
  entry('bundle.enabled', 'Bundles Enabled', 'Enable seller bundle creation', 'Commerce', `${P}commerce`),
  entry('bundle.maxPerSeller', 'Max Bundles Per Seller', 'Maximum bundles per seller', 'Commerce', `${P}commerce`),
  entry('bundle.maxDiscountPercent', 'Max Bundle Discount', 'Max discount on bundle vs individual', 'Commerce', `${P}commerce`),
  entry('bundle.minItems', 'Min Items for Bundle', 'Minimum items required for bundle', 'Commerce', `${P}commerce`),
  entry('bundle.smartPromptsEnabled', 'Smart Bundle Prompts', 'Show bundle suggestions in cart', 'Commerce', `${P}commerce`),
  entry('order.autoCompleteAfterDays', 'Auto-Complete After Days', 'Auto-complete orders after X days', 'Commerce', `${P}commerce`),
  entry('order.buyerCancelWindowHours', 'Buyer Cancel Window', 'Hours buyer can cancel after purchase', 'Commerce', `${P}commerce`),
  entry('order.maxItemsPerOrder', 'Max Items Per Order', 'Maximum items in single order', 'Commerce', `${P}commerce`),
  entry('makeMeADeal.enabled', 'Make Me A Deal Enabled', 'Enable bulk deal request feature', 'Commerce', `${P}commerce`),
  entry('cancellation.buyerWindowHours', 'Buyer Cancel Window', 'Hours buyer can cancel after purchase', 'Commerce', `${P}commerce`),
  entry('cancellation.sellerPenaltyEnabled', 'Seller Cancel Penalty', 'Penalize sellers who cancel orders', 'Commerce', `${P}commerce`),
  entry('cancellation.autoRefundOnCancel', 'Auto-Refund on Cancel', 'Automatically refund on cancellation', 'Commerce', `${P}commerce`),
  entry('listing.maxImagesPerListing', 'Max Images Per Listing', 'Maximum photos per listing', 'Commerce', `${P}commerce`),
  entry('listing.minTitleLength', 'Min Title Length', 'Minimum characters in listing title', 'Commerce', `${P}commerce`),
  entry('listing.maxTitleLength', 'Max Title Length', 'Maximum characters in listing title', 'Commerce', `${P}commerce`),
  entry('listing.durationDays', 'Default Listing Duration', 'Default listing duration in days', 'Commerce', `${P}commerce`),
  entry('listing.autoRenewEnabled', 'Auto-Renew Listings', 'Allow auto-renew of expired listings', 'Commerce', `${P}commerce`),
  entry('commerce.escrow.holdHours', 'Escrow Hold Hours', 'Hours to hold funds after delivery', 'Commerce', `${P}commerce`),

  // ── Fulfillment ────────────────────────────────────────────────────────
  entry('shipping.defaultHandlingDays', 'Default Handling Days', 'Default handling time in business days', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.maxHandlingDays', 'Max Handling Days', 'Maximum allowed handling time', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.trackingRequiredAboveCents', 'Tracking Required Above', 'Require tracking for orders above this amount', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.signatureRequiredAboveCents', 'Signature Required Above', 'Require signature for orders above this amount', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.defaultCarrier', 'Default Carrier', 'Default shipping carrier', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.labelGenerationEnabled', 'Label Generation', 'Enable shipping label generation', 'Fulfillment', `${P}fulfillment`),
  entry('shipping.enabledCarriers', 'Enabled Carriers', 'Carriers available for shipping', 'Fulfillment', `${P}fulfillment`),
  entry('insurance.autoInsureAboveCents', 'Auto-Insure Above', 'Auto-insure above this amount', 'Fulfillment', `${P}fulfillment`),
  entry('returns.labelFunding', 'Return Label Funding', 'Who pays for return shipping labels', 'Fulfillment', `${P}fulfillment`),
  entry('returns.windowDays', 'Return Window Days', 'Default return window in days', 'Fulfillment', `${P}fulfillment`),
  entry('returns.restockingFeeBps', 'Restocking Fee', 'Restocking fee in basis points', 'Fulfillment', `${P}fulfillment`),
  entry('payout.schedule', 'Payout Schedule', 'Payout frequency — daily, weekly, or monthly', 'Fulfillment', `${P}fulfillment`),
  entry('payout.minAmountCents', 'Minimum Payout Amount', 'Minimum payout amount', 'Fulfillment', `${P}fulfillment`),
  entry('payout.newSellerHoldDays', 'New Seller Hold Period', 'Hold payouts for new sellers', 'Fulfillment', `${P}fulfillment`),
  entry('payout.highRiskHoldEnabled', 'High-Risk Holds', 'Enable holds for high-risk transactions', 'Fulfillment', `${P}fulfillment`),
  entry('payout.instantEnabled', 'Instant Payouts', 'Enable instant payout feature', 'Fulfillment', `${P}fulfillment`),
  entry('payout.instantFeeBps', 'Instant Payout Fee', 'Fee for instant payouts in basis points', 'Fulfillment', `${P}fulfillment`),

  // ── Trust & Quality ────────────────────────────────────────────────────
  entry('trust.baseScore', 'Base Trust Score', 'Starting trust score for new sellers', 'Trust & Quality', `${P}trust`),
  entry('trust.bandExcellentMin', 'Excellent Band Minimum', 'Minimum score for EXCELLENT band', 'Trust & Quality', `${P}trust`),
  entry('trust.bandGoodMin', 'Good Band Minimum', 'Minimum score for GOOD band', 'Trust & Quality', `${P}trust`),
  entry('trust.bandWatchMin', 'Watch Band Minimum', 'Minimum score for WATCH band', 'Trust & Quality', `${P}trust`),
  entry('trust.decayHalfLifeDays', 'Trust Decay Half-Life', 'Days for event impact to halve', 'Trust & Quality', `${P}trust`),
  entry('trust.event.review5Star', '5-Star Review Delta', 'Trust delta for 5-star review', 'Trust & Quality', `${P}trust`),
  entry('trust.event.lateShipment', 'Late Shipment Delta', 'Trust delta for late shipment', 'Trust & Quality', `${P}trust`),
  entry('trust.event.sellerCancel', 'Seller Cancel Delta', 'Trust delta for seller cancellation', 'Trust & Quality', `${P}trust`),
  entry('trust.event.chargeback', 'Chargeback Delta', 'Trust delta for chargeback', 'Trust & Quality', `${P}trust`),
  entry('trust.event.policyViolation', 'Policy Violation Delta', 'Trust delta for policy violation', 'Trust & Quality', `${P}trust`),
  entry('trust.review.eligibleDaysAfterDelivery', 'Review Eligible Days', 'Days after delivery before review', 'Trust & Quality', `${P}trust`),
  entry('trust.review.windowDays', 'Review Window', 'Days to leave review after eligible', 'Trust & Quality', `${P}trust`),
  entry('review.allowSellerResponse', 'Allow Seller Responses', 'Allow sellers to respond to reviews', 'Trust & Quality', `${P}trust`),
  entry('review.moderationEnabled', 'Review Moderation', 'Enable review moderation', 'Trust & Quality', `${P}trust`),
  entry('trust.review.editWindowHours', 'Review Edit Window', 'Hours to edit review after posting', 'Trust & Quality', `${P}trust`),
  entry('standards.evaluationPeriodDays', 'Evaluation Period', 'Rolling window for seller evaluation', 'Trust & Quality', `${P}trust`),
  entry('standards.maxDefectRatePercent', 'Max Defect Rate', 'Maximum transaction defect rate', 'Trust & Quality', `${P}trust`),
  entry('standards.topRatedMinOrdersYear', 'Top Rated Min Orders', 'Minimum annual orders for TOP_RATED', 'Trust & Quality', `${P}trust`),

  // ── Discovery ──────────────────────────────────────────────────────────
  entry('search.titleWeight', 'Title Match Weight', 'Weight for title matches in search', 'Discovery', `${P}discovery`),
  entry('search.descriptionWeight', 'Description Match Weight', 'Weight for description matches', 'Discovery', `${P}discovery`),
  entry('search.trustMultiplierEnabled', 'Trust Multiplier', 'Boost trusted sellers in search', 'Discovery', `${P}discovery`),
  entry('search.freshnessBoostEnabled', 'Freshness Boost', 'Boost recently listed items', 'Discovery', `${P}discovery`),
  entry('search.defaultPageSize', 'Default Page Size', 'Default search results per page', 'Discovery', `${P}discovery`),
  entry('promo.boostEnabled', 'Promoted Listings', 'Enable promoted listings in search', 'Discovery', `${P}discovery`),
  entry('promo.maxBoostMultiplier', 'Max Boost Multiplier', 'Maximum ranking boost multiplier', 'Discovery', `${P}discovery`),
  entry('priceAlert.enabled', 'Price Alerts Enabled', 'Enable price drop alerts', 'Discovery', `${P}discovery`),
  entry('priceAlert.maxPerUser', 'Max Price Alerts Per User', 'Maximum price alerts per user', 'Discovery', `${P}discovery`),
  entry('marketIndex.enabled', 'Market Index', 'Compute market price indexes', 'Discovery', `${P}discovery`),
  entry('marketIndex.dealBadgesEnabled', 'Deal Badges', 'Show Great Deal badges on listings', 'Discovery', `${P}discovery`),

  // ── Communications ─────────────────────────────────────────────────────
  entry('email.enabled', 'Email Notifications', 'Enable email notifications globally', 'Communications', `${P}comms`),
  entry('email.maxPerDayPerUser', 'Max Emails Per User/Day', 'Email rate limit per user', 'Communications', `${P}comms`),
  entry('email.marketingEnabled', 'Marketing Emails', 'Enable marketing email campaigns', 'Communications', `${P}comms`),
  entry('push.enabled', 'Push Notifications', 'Enable push notifications globally', 'Communications', `${P}comms`),
  entry('sms.enabled', 'SMS Notifications', 'Enable SMS notifications globally', 'Communications', `${P}comms`),
  entry('digest.enabled', 'Email Digests', 'Enable email digest feature', 'Communications', `${P}comms`),
  entry('digest.frequency', 'Digest Frequency', 'Default digest frequency', 'Communications', `${P}comms`),
  entry('messaging.enabled', 'Buyer-Seller Messaging', 'Enable direct messaging', 'Communications', `${P}comms`),
  entry('messaging.rateLimitPerHour', 'Message Rate Limit', 'Max messages per user per hour', 'Communications', `${P}comms`),
  entry('messaging.moderationEnabled', 'Message Moderation', 'Enable message content moderation', 'Communications', `${P}comms`),

  // ── Privacy ────────────────────────────────────────────────────────────
  entry('retention.messageDays', 'Message Retention', 'Keep messages for this many days', 'Privacy', `${P}privacy`),
  entry('retention.searchLogDays', 'Search Log Retention', 'Keep search logs for this many days', 'Privacy', `${P}privacy`),
  entry('retention.auditLogDays', 'Audit Log Retention', 'Keep audit logs for compliance', 'Privacy', `${P}privacy`),
  entry('privacy.gdpr.dataExportEnabled', 'Data Export', 'Allow users to export their data', 'Privacy', `${P}privacy`),
  entry('privacy.gdpr.deletionGracePeriodDays', 'Deletion Grace Period', 'Days before permanent deletion', 'Privacy', `${P}privacy`),
  entry('privacy.gdpr.anonymizeOnDeletion', 'Anonymize on Deletion', 'Anonymize vs hard delete', 'Privacy', `${P}privacy`),
  entry('privacy.gdpr.cookieConsentRequired', 'Cookie Consent', 'Require cookie consent banner', 'Privacy', `${P}privacy`),
  entry('audit.retentionMonths', 'Audit Retention Months', 'Months before audit events are archived and purged', 'Privacy', `${P}privacy`),
  entry('audit.archiveBeforePurge', 'Archive Before Purge', 'Archive audit events to R2 before deleting', 'Privacy', `${P}privacy`),
  entry('privacy.orderRetentionYears', 'Order Retention Years', 'Years to retain pseudonymized order data for legal/tax compliance', 'Privacy', `${P}privacy`),
  entry('privacy.granularAnalyticsRetentionDays', 'Analytics Retention Days', 'Days before granular analytics data is purged', 'Privacy', `${P}privacy`),

  // ── Environment ────────────────────────────────────────────────────────
  entry('DATABASE_URL', 'Database URL', 'PostgreSQL connection string', 'Environment', '/cfg/environment'),
  entry('BETTER_AUTH_SECRET', 'Better Auth Secret', 'Secret key for authentication', 'Environment', '/cfg/environment'),
  entry('BETTER_AUTH_URL', 'Better Auth URL', 'Base URL for authentication', 'Environment', '/cfg/environment'),
  entry('CLOUDFLARE_ACCOUNT_ID', 'Cloudflare Account ID', 'Cloudflare account identifier', 'Environment', '/cfg/environment'),
  entry('R2_ACCESS_KEY_ID', 'R2 Access Key', 'Cloudflare R2 access key', 'Environment', '/cfg/environment'),
  entry('R2_SECRET_ACCESS_KEY', 'R2 Secret Key', 'Cloudflare R2 secret key', 'Environment', '/cfg/environment'),
  entry('R2_BUCKET_NAME', 'R2 Bucket Name', 'R2 storage bucket name', 'Environment', '/cfg/environment'),
  entry('R2_PUBLIC_URL', 'R2 Public URL', 'Public URL for R2 bucket', 'Environment', '/cfg/environment'),
  entry('NEXT_PUBLIC_APP_URL', 'Application URL', 'Base URL for the application', 'Environment', '/cfg/environment'),
  entry('NEXT_PUBLIC_APP_NAME', 'Application Name', 'Platform name', 'Environment', '/cfg/environment'),
  entry('CRON_SECRET', 'Cron Secret', 'Bearer token for cron job authentication', 'Environment', '/cfg/environment'),
  entry('SUPER_ADMIN_EMAIL', 'Super Admin Email', 'Initial super admin email', 'Environment', '/cfg/environment'),
];
