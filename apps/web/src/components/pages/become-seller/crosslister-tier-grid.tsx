import { Check } from 'lucide-react';
import type { CrosslisterTierCard } from '@/lib/queries/become-seller';

interface CrosslisterTierGridProps {
  tiers: CrosslisterTierCard[];
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const TIER_DISPLAY_NAMES: Record<string, string> = {
  FREE: 'Free',
  LITE: 'Lite',
  PRO: 'Pro',
};

export function CrosslisterTierGrid({ tiers }: CrosslisterTierGridProps) {
  return (
    <section className="space-y-8">
      <div className="text-center">
        <div className="tw-eyebrow mx-auto">
          <span className="tw-eyebrow-dot" />
          Crosslister
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          Sell across <em className="not-italic text-[var(--mg)]">platforms</em>
        </h2>
        <p className="mt-4 text-[17px] text-[var(--tw-muted)] max-w-2xl mx-auto leading-relaxed">
          Publish your Twicely listings to eBay, Poshmark, Depop, and more from one place.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="tw-badge tw-badge-green">Available to all sellers</span>
          <span className="tw-badge tw-badge-pale">Imports always free</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
        {tiers.map((tier, idx) => {
          const isPopular = idx === 2; // Pro tier
          return (
            <div
              key={tier.tier}
              className={`tw-pricing-card flex flex-col ${isPopular ? 'featured' : ''}`}
            >
              {isPopular && <div className="tw-pc-tag">Best value</div>}
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
                  <span>{tier.publishesPerMonth.toLocaleString()} publishes/mo</span>
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
      </div>
    </section>
  );
}
