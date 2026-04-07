import Link from 'next/link';
import { Check } from 'lucide-react';

interface BecomeSelllerHeroProps {
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export function BecomeSelllerHero({
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: BecomeSelllerHeroProps) {
  return (
    <section className="bg-white border-b border-[var(--tw-border)] py-14">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="tw-hero-shell">
          <div className="tw-hero-copy text-center" style={{ padding: '64px 40px' }}>
            <div className="tw-eyebrow mx-auto">
              <span className="tw-eyebrow-dot" />
              Start selling on Twicely
            </div>
            <h1 className="tw-hero-h1 mx-auto" style={{ maxWidth: '16ch' }}>
              Turn your closet<br />into <span className="text-[var(--mg)]">income.</span>
            </h1>
            <p className="text-[17px] text-[var(--tw-muted)] leading-relaxed mb-7 max-w-[52ch] mx-auto">
              Sell secondhand on Twicely. Free to list, simple fees, and built-in tools to help you sell more.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
              <Link href={ctaHref} className="tw-btn-mg">
                {ctaLabel}
              </Link>
              {secondaryCtaLabel && secondaryCtaHref && (
                <Link href={secondaryCtaHref} className="tw-btn-ghost">
                  {secondaryCtaLabel}
                </Link>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--tw-muted)]">
                <Check className="size-3.5 text-[var(--tw-green)] stroke-[3]" /> Free to list — no upfront fees
              </div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--tw-muted)]">
                <Check className="size-3.5 text-[var(--tw-green)] stroke-[3]" /> First $500/mo at just 10%
              </div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--tw-muted)]">
                <Check className="size-3.5 text-[var(--tw-green)] stroke-[3]" /> Lower rates as you grow — down to 8%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
