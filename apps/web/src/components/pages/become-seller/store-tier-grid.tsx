import Link from 'next/link';
import { Check } from 'lucide-react';
import type { StoreTierCard } from '@/lib/queries/become-seller';

interface StoreTierGridProps {
  tiers: StoreTierCard[];
  showUpgradeCta: boolean;
  isBusinessSeller: boolean;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const TIER_DISPLAY_NAMES: Record<string, string> = {
  NONE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  POWER: 'Power',
};

export function StoreTierGrid({ tiers, showUpgradeCta, isBusinessSeller }: StoreTierGridProps) {
  return (
    <section className="space-y-8">
      <div className="text-center">
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Store subscription
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          For sellers who want <em className="not-italic text-[var(--mg)]">more</em>
        </h2>
        <p className="mt-4 text-[17px] text-[var(--tw-muted)] max-w-2xl mx-auto leading-relaxed">
          Unlock more listings, lower insertion fees, and premium tools.
        </p>
        <div className="mt-4 inline-flex items-center gap-2">
          <span className="tw-badge tw-badge-pale">Business account required (free upgrade)</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiers.map((tier, idx) => {
          const isPopular = idx === 2; // Pro tier as popular
          return (
            <div
              key={tier.tier}
              className={`tw-pricing-card flex flex-col ${isPopular ? 'featured' : ''}`}
            >
              {isPopular && <div className="tw-pc-tag">Most popular</div>}
              <div className="mb-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tw-muted-lt)]">
                  {TIER_DISPLAY_NAMES[tier.tier] ?? tier.tier}
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--tw-black)]">
                  {tier.monthlyCents === 0
                    ? 'Free'
                    : (
                      <>
                        {formatCents(tier.monthlyCents ?? 0)}
                        <span className="text-sm font-bold text-[var(--tw-muted-lt)]">/mo</span>
                      </>
                    )}
                </p>
              </div>

              <ul className="mb-4 space-y-2 text-sm text-[var(--tw-muted)] flex-1">
                <li className="flex items-start gap-2">
                  <Check className="size-4 text-[var(--tw-green)] stroke-[3] mt-0.5 shrink-0" />
                  <span>{tier.freeListings.toLocaleString()} free listings/mo</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 text-[var(--tw-green)] stroke-[3] mt-0.5 shrink-0" />
                  <span>
                    {tier.insertionFeeCents === 0
                      ? 'No insertion fee'
                      : `${formatCents(tier.insertionFeeCents)} per listing after allowance`}
                  </span>
                </li>
                {tier.keyFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="size-4 text-[var(--tw-green)] stroke-[3] mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {/* Enterprise */}
        <div className="tw-pricing-card flex flex-col">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tw-muted-lt)]">
              Enterprise
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--tw-black)]">Custom</p>
          </div>
          <p className="mb-4 text-sm text-[var(--tw-muted)] flex-1">
            Unlimited listings, dedicated account manager, custom integrations.
          </p>
          <Link
            href="mailto:enterprise@twicely.co"
            className="text-sm font-extrabold text-[var(--mg)] hover:underline"
          >
            Contact us &rarr;
          </Link>
        </div>
      </div>

      {showUpgradeCta && isBusinessSeller ? (
        <div className="text-center">
          <Link href="/my/selling/subscription" className="tw-btn-mg">
            Upgrade subscription
          </Link>
        </div>
      ) : !showUpgradeCta ? (
        <p className="text-center text-sm text-[var(--tw-muted-lt)]">
          Available after you start selling.
        </p>
      ) : null}
    </section>
  );
}
