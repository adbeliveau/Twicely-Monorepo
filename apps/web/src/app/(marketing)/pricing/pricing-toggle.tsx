'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@twicely/utils';
import Link from 'next/link';
import { PricingComparison } from './pricing-comparison';

export interface PricingData {
  storeTiers: Array<{
    name: string;
    annual: number | null;
    monthly: number | null;
    listings: number;
    insertion: number;
    features: string[];
    popular?: boolean;
  }>;
  crosslisterTiers: Array<{
    name: string;
    annual: number;
    monthly: number;
    publishes: number;
  }>;
  bundles: Array<{
    name: string;
    annual: number;
    monthly: number;
    includes: string;
    savings: string;
  }>;
  addOns: {
    financeAnnual: number;
    financeMonthly: number;
    automationAnnual: number;
    automationMonthly: number;
  };
  tfBrackets: Array<{
    maxCents: number;
    rateBps: number;
  }>;
}

const TF_SEGMENTS = [
  'New/casual', 'Hobbyist', 'Part-time', 'Full-time',
  'Established', 'Power seller', 'Top seller', 'Enterprise',
];

function formatPrice(cents: number | null): string {
  if (cents === null) return 'Custom';
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBracketRange(maxCents: number, prevMaxCents: number | null): string {
  const low = prevMaxCents !== null ? `$${((prevMaxCents + 1) / 100).toLocaleString()}` : '$0';
  if (maxCents === -1) return `${low}+`;
  return `${low} – $${(maxCents / 100).toLocaleString()}`;
}

function formatRateBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function PricingToggle({ pricingData }: { pricingData: PricingData }) {
  const [isAnnual, setIsAnnual] = useState(true);

  const { storeTiers, crosslisterTiers, bundles, addOns, tfBrackets } = pricingData;

  return (
    <div className="space-y-20">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={cn('text-sm font-bold', !isAnnual ? 'text-[var(--tw-black)]' : 'text-[var(--tw-muted)]')}>
          Monthly
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={cn(
            'relative w-14 h-7 rounded-full transition-colors',
            isAnnual ? 'bg-[var(--mg)]' : 'bg-[var(--tw-bg-2)]'
          )}
          aria-label="Toggle annual or monthly billing"
        >
          <span
            className={cn(
              'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
              isAnnual ? 'translate-x-8' : 'translate-x-1'
            )}
          />
        </button>
        <span className={cn('text-sm font-bold flex items-center gap-2', isAnnual ? 'text-[var(--tw-black)]' : 'text-[var(--tw-muted)]')}>
          Annual
          <span className="tw-badge tw-badge-green">Save 20%+</span>
        </span>
      </div>

      {/* Store Tiers */}
      <section>
        <div className="text-center mb-10">
          <div className="tw-section-label">Store subscriptions</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            Unlock <em className="not-italic text-[var(--mg)]">storefront features</em>
          </h2>
          <p className="mt-3 text-[var(--tw-muted)]">Lower insertion fees and more free listings as you grow.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-5">
          {storeTiers.map((tier) => (
            <div key={tier.name} className={cn('tw-pricing-card', tier.popular && 'featured')}>
              {tier.popular && (
                <span className="tw-badge tw-badge-mg absolute -top-2.5 left-1/2 -translate-x-1/2">
                  Popular
                </span>
              )}
              <div className="pb-3">
                <div className="text-base font-extrabold text-[var(--tw-black)]">{tier.name}</div>
                <div className="mt-1 text-3xl font-black text-[var(--tw-black)] tracking-tight">
                  {formatPrice(isAnnual ? tier.annual : tier.monthly)}
                  {tier.annual !== null && (
                    <span className="text-sm font-semibold text-[var(--tw-muted)]">/mo</span>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-3">
                <div className="space-y-1 pb-3 border-b border-[var(--tw-border)]">
                  <p className="text-[var(--tw-muted)]">
                    <strong className="text-[var(--tw-black)]">{tier.listings.toLocaleString()}</strong> free listings/mo
                  </p>
                  <p className="text-[var(--tw-muted)]">
                    Insertion: <strong className="text-[var(--tw-black)]">${(tier.insertion / 100).toFixed(2)}</strong>
                  </p>
                </div>
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[var(--tw-muted)]">
                      <Check className="size-4 text-[var(--tw-green)] mt-0.5 shrink-0" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {tier.name === 'Enterprise' ? (
                  <a href="mailto:enterprise@twicely.co" className="tw-btn-ghost mt-4 w-full">
                    Contact Sales
                  </a>
                ) : (
                  <Link href="/auth/signup" className="tw-btn-mg mt-4 w-full">
                    Get Started Free
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Transaction Fee */}
      <section className="tw-feature-card">
        <div className="text-center mb-6">
          <div className="tw-section-label">Transaction fee</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            Lower rates as you <em className="not-italic text-[var(--mg)]">scale</em>
          </h2>
          <p className="mt-3 text-[var(--tw-muted)] max-w-2xl mx-auto">
            Your first $500/mo: 10%. The more you sell, the lower it goes — down to 8%.
          </p>
          <p className="mt-1 text-sm text-[var(--tw-muted-lt)]">
            Payment processing (Stripe ~2.9% + $0.30) shown separately.
          </p>
        </div>
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--tw-border)]">
                <th className="text-left py-3 px-3 font-extrabold text-[var(--tw-black)] uppercase text-[11px] tracking-wider">Monthly Sales</th>
                <th className="text-center py-3 px-3 font-extrabold text-[var(--tw-black)] uppercase text-[11px] tracking-wider">TF Rate</th>
                <th className="text-left py-3 px-3 font-extrabold text-[var(--tw-black)] uppercase text-[11px] tracking-wider hidden sm:table-cell">Segment</th>
              </tr>
            </thead>
            <tbody>
              {tfBrackets.map((b, i) => (
                <tr key={i} className="border-b border-[var(--tw-border)]">
                  <td className="py-3 px-3 text-[var(--tw-muted)]">{formatBracketRange(b.maxCents, i > 0 ? (tfBrackets[i - 1]?.maxCents ?? null) : null)}</td>
                  <td className="py-3 px-3 text-center font-extrabold text-[var(--mg)]">{formatRateBps(b.rateBps)}</td>
                  <td className="py-3 px-3 text-[var(--tw-muted-lt)] hidden sm:table-cell">{TF_SEGMENTS[i] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-center text-[var(--tw-muted-lt)] mt-4">
          Marginal rates (like income tax brackets). Minimum TF: $0.50/order.
        </p>
      </section>

      {/* Crosslister */}
      <section>
        <div className="text-center mb-10">
          <div className="tw-section-label">Crosslister</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            Publish <em className="not-italic text-[var(--mg)]">everywhere</em> at once
          </h2>
          <p className="mt-3 text-[var(--tw-muted)]">eBay, Poshmark, Mercari & more — built right in.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3 max-w-3xl mx-auto">
          {crosslisterTiers.map((tier) => (
            <div key={tier.name} className="tw-pricing-card">
              <div className="text-base font-extrabold text-[var(--tw-black)]">{tier.name}</div>
              <div className="mt-1 text-3xl font-black text-[var(--tw-black)] tracking-tight">
                {formatPrice(isAnnual ? tier.annual : tier.monthly)}
                {tier.annual !== null && tier.annual > 0 && (
                  <span className="text-sm font-semibold text-[var(--tw-muted)]">/mo</span>
                )}
              </div>
              <p className="mt-4 text-sm text-[var(--tw-muted)]">
                <strong className="text-[var(--tw-black)]">{tier.publishes}</strong> publishes/mo
              </p>
              <p className="text-xs text-[var(--tw-muted-lt)] mt-1">Imports always free</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bundles */}
      <section>
        <div className="text-center mb-10">
          <div className="tw-section-label">Bundles</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            Combine and <em className="not-italic text-[var(--mg)]">save more</em>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3 max-w-4xl mx-auto">
          {bundles.map((b) => (
            <div key={b.name} className="tw-pricing-card">
              <div className="text-base font-extrabold text-[var(--tw-black)]">{b.name}</div>
              <div className="mt-1 text-3xl font-black text-[var(--tw-black)] tracking-tight">
                {formatPrice(isAnnual ? b.annual : b.monthly)}
                <span className="text-sm font-semibold text-[var(--tw-muted)]">/mo</span>
              </div>
              <span className="tw-badge tw-badge-green mt-3 inline-flex w-fit">Save {b.savings}</span>
              <p className="mt-3 text-sm text-[var(--tw-muted)]">{b.includes}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Competitor Comparison */}
      <PricingComparison tfBrackets={tfBrackets} />

      {/* Add-ons */}
      <section>
        <div className="text-center mb-10">
          <div className="tw-section-label">Add-ons</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
            Power-up <em className="not-italic text-[var(--mg)]">tools</em>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 max-w-2xl mx-auto">
          <div className="tw-pricing-card">
            <div className="text-base font-extrabold text-[var(--tw-black)]">Finance Pro</div>
            <p className="mt-1 text-sm text-[var(--tw-muted)]">Full P&amp;L, expense tracking, tax prep</p>
            <div className="mt-3 text-2xl font-black text-[var(--tw-black)] tracking-tight">
              {formatPrice(isAnnual ? addOns.financeAnnual : addOns.financeMonthly)}
              <span className="text-sm font-semibold text-[var(--tw-muted)]">/mo</span>
            </div>
          </div>
          <div className="tw-pricing-card">
            <div className="text-base font-extrabold text-[var(--tw-black)]">Automation</div>
            <p className="mt-1 text-sm text-[var(--tw-muted)]">Auto-relist, smart price drops, Posh sharing</p>
            <div className="mt-3 text-2xl font-black text-[var(--tw-black)] tracking-tight">
              {formatPrice(isAnnual ? addOns.automationAnnual : addOns.automationMonthly)}
              <span className="text-sm font-semibold text-[var(--tw-muted)]">/mo</span>
            </div>
            <p className="text-xs text-[var(--tw-muted-lt)] mt-1">2,000 actions/mo</p>
          </div>
        </div>
      </section>
    </div>
  );
}
