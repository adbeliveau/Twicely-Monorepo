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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sell across platforms — optional crosslister</h2>
        <p className="mt-2 text-muted-foreground">
          Publish your Twicely listings to eBay, Poshmark, Depop, and more from one place.
        </p>
      </div>

      <div className="space-y-2">
        <div className="rounded-md border bg-green-50 px-4 py-3 text-sm text-green-900 dark:bg-green-950/30 dark:text-green-200">
          Available to all sellers — no business account required.
        </div>
        <div className="rounded-md border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          Importing your existing listings from eBay, Poshmark, and more is always free.
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
              <li>{tier.publishesPerMonth.toLocaleString()} publishes/mo</li>
              {tier.keyFeatures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
