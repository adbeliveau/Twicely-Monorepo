import Link from 'next/link';
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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Optional store subscription — for sellers who want more</h2>
        <p className="mt-2 text-muted-foreground">
          Unlock more listings, lower insertion fees, and premium tools. Requires a business account.
        </p>
      </div>

      <div className="rounded-md border bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Store subscriptions require a business account (free upgrade).
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.tier}
            className="flex flex-col rounded-lg border bg-card p-5 shadow-sm"
          >
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {TIER_DISPLAY_NAMES[tier.tier] ?? tier.tier}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {tier.monthlyCents === 0
                  ? 'Free'
                  : `${formatCents(tier.monthlyCents ?? 0)}/mo`}
              </p>
            </div>

            <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
              <li>{tier.freeListings.toLocaleString()} free listings/mo</li>
              <li>
                {tier.insertionFeeCents === 0
                  ? 'No insertion fee'
                  : `${formatCents(tier.insertionFeeCents)} per listing after allowance`}
              </li>
              {tier.keyFeatures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}

        {/* Enterprise */}
        <div className="flex flex-col rounded-lg border bg-card p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Enterprise
            </p>
            <p className="mt-1 text-2xl font-bold">Custom pricing</p>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Unlimited listings, dedicated account manager, custom integrations.
          </p>
          <Link
            href="mailto:enterprise@twicely.co"
            className="mt-auto text-sm font-medium text-primary hover:underline"
          >
            Contact us
          </Link>
        </div>
      </div>

      {showUpgradeCta && isBusinessSeller ? (
        <div className="text-center">
          <Link
            href="/my/selling/subscription"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            Upgrade subscription
          </Link>
        </div>
      ) : !showUpgradeCta ? (
        <p className="text-center text-sm text-muted-foreground">
          Available after you start selling.
        </p>
      ) : null}
    </section>
  );
}
