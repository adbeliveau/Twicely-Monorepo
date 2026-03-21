import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getBecomeSelllerPricing, getSellerStatusForCtaRouting } from '@/lib/queries/become-seller';
import { resolveCtaRouting } from '@/components/pages/become-seller/cta-routing';
import { BecomeSelllerHero } from '@/components/pages/become-seller/become-seller-hero';
import { TfBracketTable } from '@/components/pages/become-seller/tf-bracket-table';
import { StoreTierGrid } from '@/components/pages/become-seller/store-tier-grid';
import { CrosslisterTierGrid } from '@/components/pages/become-seller/crosslister-tier-grid';

export const metadata: Metadata = {
  title: 'Start Selling on Twicely | Twicely',
  description:
    'Turn your closet into income. Free to list, simple fees, and built-in tools to help you sell more.',
};

async function loadCtaConfig() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return resolveCtaRouting({ isAuthenticated: false, isSeller: false, sellerType: null });
  }

  const sellerStatus = await getSellerStatusForCtaRouting(session.user.id);
  return resolveCtaRouting({
    isAuthenticated: true,
    isSeller: sellerStatus.isSeller,
    sellerType: sellerStatus.sellerType,
  });
}

export default async function BecomeSellerPage() {
  const [pricing, ctaConfig] = await Promise.all([
    getBecomeSelllerPricing(),
    loadCtaConfig(),
  ]);

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Section 1: Hero */}
      <BecomeSelllerHero
        ctaLabel={ctaConfig.ctaLabel}
        ctaHref={ctaConfig.ctaHref}
        secondaryCtaLabel={ctaConfig.secondaryCtaLabel}
        secondaryCtaHref={ctaConfig.secondaryCtaHref}
      />

      {/* Section 2: How it works */}
      <section className="mx-auto w-full max-w-4xl space-y-8">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              1
            </div>
            <h3 className="font-semibold">Create a free listing</h3>
            <p className="text-sm text-muted-foreground">
              List anything from your closet for free. Photos, description, and price — you are live
              in minutes. Your first listing activates selling automatically.
            </p>
            <Link
              href="/my/selling/listings/new"
              className="text-sm font-medium text-primary hover:underline"
            >
              Start listing
            </Link>
          </div>

          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              2
            </div>
            <h3 className="font-semibold">Sell and get paid</h3>
            <p className="text-sm text-muted-foreground">
              When your item sells, funds are held in escrow for 72 hours after the buyer confirms
              delivery. Once released, they appear as available for payout — ready to request at any
              time.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              3
            </div>
            <h3 className="font-semibold">Grow with tools</h3>
            <p className="text-sm text-muted-foreground">
              Optional crosslister, analytics, and store subscriptions help you sell more across
              platforms. Start free — upgrade when you are ready.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Transaction fee explainer */}
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Simple, transparent fees</h2>
          <p className="mt-2 text-muted-foreground">
            Your first $500 every month? Just 10%. The more you sell, the lower it goes — all the
            way down to 8%.
          </p>
        </div>

        <TfBracketTable brackets={pricing.tfBrackets} />

        <p className="text-sm text-muted-foreground">
          Plus payment processing (shown as a separate line item on every sale). Rates reset each
          calendar month.
        </p>
      </section>

      {/* Section 4: Store subscription tiers */}
      <section className="mx-auto w-full max-w-5xl">
        <StoreTierGrid
          tiers={pricing.storeTiers}
          showUpgradeCta={ctaConfig.isSeller}
          isBusinessSeller={ctaConfig.isBusinessSeller}
        />
      </section>

      {/* Section 5: Crosslister pricing */}
      <section className="mx-auto w-full max-w-5xl">
        <CrosslisterTierGrid tiers={pricing.crosslisterTiers} />
      </section>

      {/* Section 6: Footer CTA */}
      <section className="mx-auto w-full max-w-2xl space-y-4 text-center">
        <h2 className="text-xl font-bold">Ready to start?</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={ctaConfig.ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ctaConfig.ctaLabel}
          </Link>
          {ctaConfig.isSeller && (
            <Link
              href="/my/selling"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Already selling? Go to your dashboard
            </Link>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          <Link href="/p/fees" className="hover:underline">
            View full fee schedule
          </Link>
        </p>
      </section>
    </div>
  );
}
