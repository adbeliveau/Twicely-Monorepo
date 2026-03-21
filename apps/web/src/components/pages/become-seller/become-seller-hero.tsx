import Link from 'next/link';

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
    <section className="flex flex-col items-center gap-6 py-16 text-center md:py-20">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
        Turn your closet into income.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Sell secondhand on Twicely. Free to list, simple fees, and built-in tools to help you sell
        more.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ctaLabel}
        </Link>
        {secondaryCtaLabel && secondaryCtaHref && (
          <Link
            href={secondaryCtaHref}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-semibold shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {secondaryCtaLabel}
          </Link>
        )}
      </div>

      <p className="max-w-lg text-sm text-muted-foreground">
        Your first $500 every month? Just 10%. The more you sell, the lower it goes — all the way
        down to 8%.
      </p>
    </section>
  );
}
