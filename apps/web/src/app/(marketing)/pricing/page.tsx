import { Metadata } from 'next';
import { PricingToggle, type PricingData } from './pricing-toggle';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export const metadata: Metadata = {
  title: 'Pricing — Twicely',
  description: 'Simple, transparent fees. Start at 10%, drop to 8% as you grow. No hidden costs.',
};

async function loadPricingData(): Promise<PricingData> {
  const [
    // Store tier prices
    starterAnnual, starterMonthly, proAnnual, proMonthly, powerAnnual, powerMonthly,
    // Insertion fees
    insertNone, insertStarter, insertPro, insertPower, insertEnterprise,
    // Free listings
    listNone, listStarter, listPro, listPower, listEnterprise,
    // Crosslister prices
    clLiteAnnual, clLiteMonthly, clProAnnual, clProMonthly,
    // Crosslister publishes
    clPubFree, clPubLite, clPubPro,
    // Bundle prices
    bStarterAnnual, bStarterMonthly, bProAnnual, bProMonthly, bPowerAnnual, bPowerMonthly,
    // Finance Pro
    finAnnual, finMonthly,
    // Automation
    autoAnnual, autoMonthly,
    // TF brackets
    b1Max, b1Rate, b2Max, b2Rate, b3Max, b3Rate, b4Max, b4Rate,
    b5Max, b5Rate, b6Max, b6Rate, b7Max, b7Rate, b8Rate,
  ] = await Promise.all([
    getPlatformSetting<number>('store.pricing.starter.annualCents', 699),
    getPlatformSetting<number>('store.pricing.starter.monthlyCents', 1200),
    getPlatformSetting<number>('store.pricing.pro.annualCents', 2999),
    getPlatformSetting<number>('store.pricing.pro.monthlyCents', 3999),
    getPlatformSetting<number>('store.pricing.power.annualCents', 5999),
    getPlatformSetting<number>('store.pricing.power.monthlyCents', 7999),
    getPlatformSetting<number>('fees.insertion.NONE', 35),
    getPlatformSetting<number>('fees.insertion.STARTER', 25),
    getPlatformSetting<number>('fees.insertion.PRO', 10),
    getPlatformSetting<number>('fees.insertion.POWER', 5),
    getPlatformSetting<number>('fees.insertion.ENTERPRISE', 0),
    getPlatformSetting<number>('fees.freeListings.NONE', 100),
    getPlatformSetting<number>('fees.freeListings.STARTER', 250),
    getPlatformSetting<number>('fees.freeListings.PRO', 2000),
    getPlatformSetting<number>('fees.freeListings.POWER', 15000),
    getPlatformSetting<number>('fees.freeListings.ENTERPRISE', 100000),
    getPlatformSetting<number>('crosslister.pricing.lite.annualCents', 999),
    getPlatformSetting<number>('crosslister.pricing.lite.monthlyCents', 1399),
    getPlatformSetting<number>('crosslister.pricing.pro.annualCents', 2999),
    getPlatformSetting<number>('crosslister.pricing.pro.monthlyCents', 3999),
    getPlatformSetting<number>('crosslister.publishes.FREE', 5),
    getPlatformSetting<number>('crosslister.publishes.LITE', 200),
    getPlatformSetting<number>('crosslister.publishes.PRO', 2000),
    getPlatformSetting<number>('bundle.starter.annualCents', 1799),
    getPlatformSetting<number>('bundle.starter.monthlyCents', 2499),
    getPlatformSetting<number>('bundle.pro.annualCents', 5999),
    getPlatformSetting<number>('bundle.pro.monthlyCents', 7499),
    getPlatformSetting<number>('bundle.power.annualCents', 8999),
    getPlatformSetting<number>('bundle.power.monthlyCents', 10999),
    getPlatformSetting<number>('finance.pricing.pro.annualCents', 999),
    getPlatformSetting<number>('finance.pricing.pro.monthlyCents', 1499),
    getPlatformSetting<number>('automation.pricing.annualCents', 999),
    getPlatformSetting<number>('automation.pricing.monthlyCents', 1299),
    getPlatformSetting<number>('commerce.tf.bracket1.maxCents', 49900),
    getPlatformSetting<number>('commerce.tf.bracket1.rate', 1000),
    getPlatformSetting<number>('commerce.tf.bracket2.maxCents', 199900),
    getPlatformSetting<number>('commerce.tf.bracket2.rate', 1100),
    getPlatformSetting<number>('commerce.tf.bracket3.maxCents', 499900),
    getPlatformSetting<number>('commerce.tf.bracket3.rate', 1050),
    getPlatformSetting<number>('commerce.tf.bracket4.maxCents', 999900),
    getPlatformSetting<number>('commerce.tf.bracket4.rate', 1000),
    getPlatformSetting<number>('commerce.tf.bracket5.maxCents', 2499900),
    getPlatformSetting<number>('commerce.tf.bracket5.rate', 950),
    getPlatformSetting<number>('commerce.tf.bracket6.maxCents', 4999900),
    getPlatformSetting<number>('commerce.tf.bracket6.rate', 900),
    getPlatformSetting<number>('commerce.tf.bracket7.maxCents', 9999900),
    getPlatformSetting<number>('commerce.tf.bracket7.rate', 850),
    getPlatformSetting<number>('commerce.tf.bracket8.rate', 800),
  ]);

  return {
    storeTiers: [
      { name: 'Free', annual: 0, monthly: 0, listings: listNone, insertion: insertNone, features: ['Seller profile', 'Manual payouts ($15 min)'] },
      { name: 'Starter', annual: starterAnnual, monthly: starterMonthly, listings: listStarter, insertion: insertStarter, features: ['Announcement bar', 'Social links', 'Weekly auto-payout'] },
      { name: 'Pro', annual: proAnnual, monthly: proMonthly, listings: listPro, insertion: insertPro, features: ['Custom categories', 'Bulk tools', 'Analytics', 'Boosting', 'Coupons'], popular: true },
      { name: 'Power', annual: powerAnnual, monthly: powerMonthly, listings: listPower, insertion: insertPower, features: ['Puck page builder', 'Market intelligence', 'Daily auto-payout', '25 staff accounts'] },
      { name: 'Enterprise', annual: null, monthly: null, listings: listEnterprise, insertion: insertEnterprise, features: ['100K+ listings', 'API access', 'Dedicated rep', 'Free daily payouts'] },
    ],
    crosslisterTiers: [
      { name: 'Free', annual: 0, monthly: 0, publishes: clPubFree },
      { name: 'Lite', annual: clLiteAnnual, monthly: clLiteMonthly, publishes: clPubLite },
      { name: 'Pro', annual: clProAnnual, monthly: clProMonthly, publishes: clPubPro },
    ],
    bundles: [
      { name: 'Seller Starter', annual: bStarterAnnual, monthly: bStarterMonthly, includes: 'Store Starter + Finance Pro', savings: '~$4/mo' },
      { name: 'Seller Pro', annual: bProAnnual, monthly: bProMonthly, includes: 'Store Pro + Crosslister Pro + Finance Pro', savings: '~$20/mo' },
      { name: 'Seller Power', annual: bPowerAnnual, monthly: bPowerMonthly, includes: 'Store Power + Crosslister Pro + Finance Pro + Automation', savings: '~$30/mo' },
    ],
    addOns: {
      financeAnnual: finAnnual,
      financeMonthly: finMonthly,
      automationAnnual: autoAnnual,
      automationMonthly: autoMonthly,
    },
    tfBrackets: [
      { maxCents: b1Max, rateBps: b1Rate },
      { maxCents: b2Max, rateBps: b2Rate },
      { maxCents: b3Max, rateBps: b3Rate },
      { maxCents: b4Max, rateBps: b4Rate },
      { maxCents: b5Max, rateBps: b5Rate },
      { maxCents: b6Max, rateBps: b6Rate },
      { maxCents: b7Max, rateBps: b7Rate },
      { maxCents: -1, rateBps: b8Rate },
    ],
  };
}

export default async function PricingPage() {
  const pricingData = await loadPricingData();

  return (
    <div className="tw-surface tw-fullwidth py-16">
      <div className="mx-auto max-w-[1380px] px-7">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="tw-eyebrow">
            <span className="tw-eyebrow-dot" />
            Pricing
          </div>
          <h1 className="tw-section-title">
            Simple, <em>transparent</em> pricing
          </h1>
          <p className="mt-4 text-[17px] text-[var(--tw-muted)] leading-relaxed max-w-2xl mx-auto">
            Your first $500 every month? Just 10%. The more you sell, the lower it goes — all the way down to 8%.
          </p>
        </div>

        {/* Interactive pricing sections */}
        <PricingToggle pricingData={pricingData} />

        {/* Footer */}
        <div className="mt-16 text-center space-y-2">
          <p className="text-sm text-[var(--tw-muted)]">
            All paid plans come with a 14-day free trial. Cancel anytime.
          </p>
          <p className="text-xs text-[var(--tw-muted-lt)]">
            Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity.
          </p>
        </div>
      </div>
    </div>
  );
}
