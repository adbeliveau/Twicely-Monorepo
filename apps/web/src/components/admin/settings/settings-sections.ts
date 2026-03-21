/** Section definitions — groups settings by product/feature within each tab */

export interface TierTableDef {
  title: string;
  help?: string;
  rowHeader: string;
  columns: string[];
  rows: { label: string; keys: string[] }[];
}

export interface SectionDef {
  title: string;
  description?: string;
  tables?: TierTableDef[];
  keyPrefixes: string[];
}

/** Keys already managed on /cfg/monetization */
export function isExcludedKey(key: string): boolean {
  return key.startsWith('commerce.tf.');
}

export const TAB_SECTIONS: Record<string, SectionDef[]> = {
  fees: [
    {
      title: 'Store',
      description: 'Store subscription tiers and per-listing fees charged to sellers',
      tables: [
        {
          title: 'Subscription Pricing', rowHeader: 'Tier', columns: ['Monthly', 'Annual (per month)'],
          help: 'Recurring fees for store features. Annual plans bill yearly at a discounted monthly rate. Changes affect new subscribers only — existing subscribers keep their rate until renewal.',
          rows: [
            { label: 'Starter', keys: ['store.pricing.starter.monthlyCents', 'store.pricing.starter.annualCents'] },
            { label: 'Pro', keys: ['store.pricing.pro.monthlyCents', 'store.pricing.pro.annualCents'] },
            { label: 'Power', keys: ['store.pricing.power.monthlyCents', 'store.pricing.power.annualCents'] },
          ],
        },
        {
          title: 'Tier Limits', rowHeader: 'Tier', columns: ['Insertion Fee', 'Free Listings/mo'],
          help: 'Each new listing costs the insertion fee after free listings are used up. Imports from other platforms are always free and do not count toward the limit.',
          rows: [
            { label: 'Free', keys: ['fees.insertion.NONE', 'fees.freeListings.NONE'] },
            { label: 'Starter', keys: ['fees.insertion.STARTER', 'fees.freeListings.STARTER'] },
            { label: 'Pro', keys: ['fees.insertion.PRO', 'fees.freeListings.PRO'] },
            { label: 'Power', keys: ['fees.insertion.POWER', 'fees.freeListings.POWER'] },
            { label: 'Enterprise', keys: ['fees.insertion.ENTERPRISE', 'fees.freeListings.ENTERPRISE'] },
          ],
        },
      ],
      keyPrefixes: ['store.', 'fees.'],
    },
    {
      title: 'Crosslister',
      description: 'Crosslister subscription, monthly allowances, and overage packs',
      tables: [
        {
          title: 'Subscription Pricing', rowHeader: 'Tier', columns: ['Monthly', 'Annual (per month)'],
          rows: [
            { label: 'Lite', keys: ['crosslister.pricing.lite.monthlyCents', 'crosslister.pricing.lite.annualCents'] },
            { label: 'Pro', keys: ['crosslister.pricing.pro.monthlyCents', 'crosslister.pricing.pro.annualCents'] },
          ],
        },
        {
          title: 'Monthly Allowances', rowHeader: 'Tier', columns: ['Publishes', 'AI Credits', 'BG Removals'],
          help: 'Usage included with each Crosslister tier each month. Unused credits roll over based on the rollover settings below.',
          rows: [
            { label: 'Free', keys: ['crosslister.publishes.FREE', '', ''] },
            { label: 'Lite', keys: ['crosslister.publishes.LITE', 'crosslister.aiCredits.LITE', 'crosslister.bgRemovals.LITE'] },
            { label: 'Pro', keys: ['crosslister.publishes.PRO', 'crosslister.aiCredits.PRO', 'crosslister.bgRemovals.PRO'] },
          ],
        },
        {
          title: 'Overage Packs', rowHeader: 'Pack', columns: ['Quantity', 'Price'],
          help: 'One-time credit packs for Crosslister users who exceed their monthly publishing, AI, or background removal allowances. Purchased on demand from the Crosslister dashboard.',
          rows: [
            { label: 'Publishes', keys: ['overage.publishes.qty', 'overage.publishes.cents'] },
            { label: 'AI Credits', keys: ['overage.aiCredits.qty', 'overage.aiCredits.cents'] },
            { label: 'BG Removals', keys: ['overage.bgRemovals.qty', 'overage.bgRemovals.cents'] },
          ],
        },
      ],
      keyPrefixes: ['crosslister.', 'overage.publishes', 'overage.aiCredits', 'overage.bgRemovals'],
    },
    {
      title: 'Bundles',
      description: 'Discounted subscription packages combining Store + Crosslister',
      tables: [{
        title: 'Bundle Pricing', rowHeader: 'Bundle', columns: ['Monthly', 'Annual (per month)'],
        help: 'Pre-packaged Store + Crosslister combinations sold at a discount vs buying each separately. Bundles include Finance Pro free for the trial period.',
        rows: [
          { label: 'Starter', keys: ['bundle.starter.monthlyCents', 'bundle.starter.annualCents'] },
          { label: 'Pro', keys: ['bundle.pro.monthlyCents', 'bundle.pro.annualCents'] },
          { label: 'Power', keys: ['bundle.power.monthlyCents', 'bundle.power.annualCents'] },
        ],
      }],
      keyPrefixes: ['bundle.starter', 'bundle.pro', 'bundle.power'],
    },
    {
      title: 'Finance Pro',
      description: 'Financial center add-on for advanced P&L, tax prep, and mileage tracking',
      keyPrefixes: ['finance.'],
    },
    {
      title: 'Automation',
      description: 'Automation add-on for scheduled repricing, bulk operations, and workflows',
      tables: [{
        title: 'Automation Overage', rowHeader: 'Pack', columns: ['Quantity', 'Price'],
        help: 'One-time action packs for automation users who exceed their monthly included actions.',
        rows: [
          { label: 'Actions', keys: ['overage.automation.qty', 'overage.automation.cents'] },
        ],
      }],
      keyPrefixes: ['automation.', 'overage.automation'],
    },
    {
      title: 'Authentication',
      description: 'Item authentication service fees for verifying luxury/high-value items',
      keyPrefixes: ['auth.'],
    },
  ],
  payments: [
    {
      title: 'Payouts',
      description: 'Payout schedules, minimum thresholds, and instant payout settings',
      tables: [{
        title: 'Minimum Payout by Tier', rowHeader: 'Tier', columns: ['Minimum'],
        help: 'The minimum net earnings a seller must accumulate before requesting a payout. Lower tiers have higher minimums to reduce per-transfer Stripe costs.',
        rows: [
          { label: 'Free', keys: ['payout.minimumNoneCents'] },
          { label: 'Starter', keys: ['payout.minimumStarterCents'] },
          { label: 'Pro', keys: ['payout.minimumProCents'] },
          { label: 'Power', keys: ['payout.minimumPowerCents'] },
          { label: 'Enterprise', keys: ['payout.minimumEnterpriseCents'] },
        ],
      }],
      keyPrefixes: ['payout.'],
    },
    {
      title: 'Stripe Costs',
      description: 'Stripe fees absorbed by the platform — not charged to sellers',
      tables: [{
        title: 'Fee Schedule', rowHeader: 'Fee', columns: ['Amount'],
        help: 'These are Stripe\'s charges to us. They are NOT passed to sellers. Changing these should only reflect actual Stripe pricing changes.',
        rows: [
          { label: 'Active Account Fee', keys: ['stripe.activeAccountFeeCents'] },
          { label: 'Payout Fixed Fee', keys: ['stripe.payoutFixedCents'] },
          { label: 'Payout Percentage', keys: ['stripe.payoutPercentBps'] },
          { label: 'Funds Routing', keys: ['stripe.fundsRoutingBps'] },
          { label: 'Instant Payout Rate', keys: ['stripe.instantPayoutBps'] },
          { label: 'Subscription Billing', keys: ['stripe.subscriptionBillingBps'] },
          { label: 'IRS E-File', keys: ['stripe.irsEfileCents'] },
          { label: 'State E-File', keys: ['stripe.stateEfileCents'] },
          { label: 'Processing Rate', keys: ['commerce.stripe.processingRateBps'] },
          { label: 'Processing Fixed', keys: ['commerce.stripe.processingFixedCents'] },
        ],
      }],
      keyPrefixes: ['stripe.', 'commerce.stripe.'],
    },
  ],
  commerce: [
    { title: 'Cart', description: 'Shopping cart behavior, timeouts, and limits', keyPrefixes: ['cart.'] },
    { title: 'Offers', description: 'Make Offer feature — limits, expiration, auto-decline', keyPrefixes: ['offer.'] },
    { title: 'Bundles', description: 'Seller-created product bundles on listings', keyPrefixes: ['bundle.'] },
    { title: 'Orders', description: 'Order processing, auto-complete, and limits', keyPrefixes: ['order.'] },
    { title: 'Listings', description: 'Listing creation rules — photos, titles, duration', keyPrefixes: ['listing.'] },
    { title: 'Cancellations', description: 'Order cancellation windows and penalties', keyPrefixes: ['cancellation.'] },
    { title: 'Escrow & Disputes', description: 'Fund hold periods and dispute review deadlines', keyPrefixes: ['commerce.escrow.', 'commerce.dispute.'] },
    { title: 'Local Pickup', description: 'In-person meetup, QR confirmation, and no-show rules', keyPrefixes: ['commerce.local.'] },
  ],
  fulfillment: [
    { title: 'Shipping', description: 'Handling times, carrier defaults, and tracking thresholds', keyPrefixes: ['shipping.', 'commerce.shipping.'] },
    { title: 'Returns & Insurance', description: 'Return windows, restocking, and auto-insurance', keyPrefixes: ['returns.', 'insurance.', 'commerce.returns.'] },
    { title: 'Payout Holds', description: 'Extended holds for new sellers and high-risk transactions', keyPrefixes: ['payout.'] },
  ],
  trust: [
    { title: 'Trust Score', description: 'How seller trust scores are calculated, classified, and decay over time', keyPrefixes: ['trust.'] },
    { title: 'Reviews', description: 'Review eligibility, edit windows, moderation, and seller responses', keyPrefixes: ['review.'] },
    { title: 'Seller Standards', description: 'Performance evaluation periods and tier requirements', keyPrefixes: ['standards.'] },
  ],
  discovery: [
    { title: 'Search', description: 'Search ranking weights and result page settings', keyPrefixes: ['search.'] },
    { title: 'Promotions', description: 'Promoted listings, boost rates, and attribution', keyPrefixes: ['promo.', 'boost.'] },
    { title: 'Price Alerts', description: 'Price drop notification limits', keyPrefixes: ['priceAlert.'] },
    { title: 'Market Index', description: 'Market pricing intelligence and deal badges', keyPrefixes: ['marketIndex.'] },
  ],
  comms: [
    { title: 'Email', description: 'Transactional and marketing email settings', keyPrefixes: ['email.'] },
    { title: 'Push & SMS', description: 'Push notification and SMS channel settings', keyPrefixes: ['push.', 'sms.'] },
    { title: 'Digest', description: 'Periodic email digest frequency and delivery', keyPrefixes: ['digest.'] },
    { title: 'Messaging', description: 'Buyer-seller direct messaging rate limits and moderation', keyPrefixes: ['messaging.'] },
  ],
  privacy: [
    { title: 'Data Retention', description: 'How long messages, search logs, and audit records are kept', keyPrefixes: ['retention.'] },
    { title: 'GDPR', description: 'EU data protection — export, deletion, consent', keyPrefixes: ['gdpr.'] },
  ],
};
