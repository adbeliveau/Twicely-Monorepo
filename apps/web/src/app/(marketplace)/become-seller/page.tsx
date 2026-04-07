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
    <div className="tw-fullwidth bg-white">
      {/* Section 1: Hero */}
      <BecomeSelllerHero
        ctaLabel={ctaConfig.ctaLabel}
        ctaHref={ctaConfig.ctaHref}
        secondaryCtaLabel={ctaConfig.secondaryCtaLabel}
        secondaryCtaHref={ctaConfig.secondaryCtaHref}
      />

      {/* Section 2: How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="text-center mb-10">
            <div className="tw-eyebrow mx-auto">
              <span className="tw-eyebrow-dot" />
              How it works
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
              Three steps to <em className="not-italic text-[var(--mg)]">selling</em>
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 max-w-5xl mx-auto">
            <div className="tw-feature-card">
              <div className="tw-step-num mb-4">1</div>
              <h3 className="text-lg font-extrabold text-[var(--tw-black)] mb-2">Create a free listing</h3>
              <p className="text-sm text-[var(--tw-muted)] leading-relaxed mb-3">
                List anything from your closet for free. Photos, description, and price &mdash; you are
                live in minutes. Your first listing activates selling automatically.
              </p>
              <Link
                href="/my/selling/listings/new"
                className="text-sm font-extrabold text-[var(--mg)] hover:underline"
              >
                Start listing &rarr;
              </Link>
            </div>

            <div className="tw-feature-card">
              <div className="tw-step-num mb-4">2</div>
              <h3 className="text-lg font-extrabold text-[var(--tw-black)] mb-2">Sell and get paid</h3>
              <p className="text-sm text-[var(--tw-muted)] leading-relaxed">
                When your item sells, funds are held in escrow for 72 hours after the buyer confirms
                delivery. Once released, they appear as available for payout &mdash; ready to request at
                any time.
              </p>
            </div>

            <div className="tw-feature-card">
              <div className="tw-step-num mb-4">3</div>
              <h3 className="text-lg font-extrabold text-[var(--tw-black)] mb-2">Grow with tools</h3>
              <p className="text-sm text-[var(--tw-muted)] leading-relaxed">
                Optional crosslister, analytics, and store subscriptions help you sell more across
                platforms. Start free &mdash; upgrade when you are ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Transaction fee explainer */}
      <section className="py-16 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="text-center mb-10">
            <div className="tw-eyebrow mx-auto">
              <span className="tw-eyebrow-dot" />
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
              Simple, <em className="not-italic text-[var(--mg)]">transparent</em> fees
            </h2>
            <p className="mt-4 text-[17px] text-[var(--tw-muted)] max-w-2xl mx-auto leading-relaxed">
              Your first $500 every month? Just 10%. The more you sell, the lower it goes &mdash; all
              the way down to 8%.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <TfBracketTable brackets={pricing.tfBrackets} />
            <p className="mt-4 text-center text-sm text-[var(--tw-muted-lt)]">
              Plus payment processing (shown as a separate line item on every sale). Rates reset each
              calendar month.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Store subscription tiers */}
      <section className="py-16">
        <div className="mx-auto max-w-[1380px] px-7">
          <StoreTierGrid
            tiers={pricing.storeTiers}
            showUpgradeCta={ctaConfig.isSeller}
            isBusinessSeller={ctaConfig.isBusinessSeller}
          />
        </div>
      </section>

      {/* Section 5: Crosslister pricing */}
      <section className="py-16 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-[1380px] px-7">
          <CrosslisterTierGrid tiers={pricing.crosslisterTiers} />
        </div>
      </section>

      {/* Section 6: Footer CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="tw-feature-card text-center max-w-3xl mx-auto">
            <div className="tw-eyebrow mx-auto">
              <span className="tw-eyebrow-dot" />
              Get started
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
              Ready to <em className="not-italic text-[var(--mg)]">start</em>?
            </h2>
            <p className="mt-3 text-[var(--tw-muted)]">
              Join thousands of sellers turning their closets into income.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href={ctaConfig.ctaHref} className="tw-btn-mg">
                {ctaConfig.ctaLabel}
              </Link>
              {ctaConfig.isSeller && (
                <Link href="/my/selling" className="tw-btn-ghost">
                  Go to dashboard
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-[var(--tw-muted-lt)]">
              <Link href="/p/fees" className="hover:underline">
                View full fee schedule
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
