import Link from 'next/link';
import Image from 'next/image';
import type { ExploreCollection } from '@/lib/queries/explore';

interface Props {
  collections: ExploreCollection[];
}

export function LandingDrops({ collections }: Props) {
  if (collections.length === 0) {
    // Fallback: show the static promo if no collections exist yet
    return (
      <section className="bg-white py-14 reveal">
        <div className="mx-auto max-w-[1380px] px-7">
          <div className="drops-layout grid grid-cols-2 gap-10 items-center">
            <div className="grid gap-3">
              <div className="drop-card featured">
                <div className="flex items-center gap-1.5 mb-2 text-[11px] font-extrabold tracking-[0.12em] uppercase text-[var(--mg)]">
                  <div className="live-dot" /> Coming Soon
                </div>
                <div className="font-black text-[19px] text-white mb-1.5">Drops are coming</div>
                <p className="text-[13px] text-white/55 leading-normal mb-3">
                  Curated shopping events where sellers share their best inventory and buyers get exclusive access and bundle discounts.
                </p>
                <Link href="/explore" className="btn-sm-mg">Explore &rarr;</Link>
              </div>
            </div>
            <div>
              <div className="section-label">Drops</div>
              <div className="section-title">Shopping as<br />an <em className="italic text-[var(--mg)]">event</em></div>
              <p className="text-[16px] text-[var(--l-muted)] leading-relaxed mb-6 max-w-[520px]">
                Twicely Drops turn category shopping into real-time events. Sellers queue their best inventory. Buyers arrive, bundle, and score.
              </p>
              <Link href="/explore" className="btn-mg mt-2">See all drops &rarr;</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const featured = collections[0]!;
  const upcoming = collections.slice(1, 3);

  return (
    <section className="bg-white py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="drops-layout grid grid-cols-2 gap-10 items-center">
          {/* Left: Drop cards */}
          <div className="grid gap-3">
            {/* Featured collection */}
            <Link href={`/explore`} className="drop-card featured">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-extrabold tracking-[0.12em] uppercase text-[var(--mg)]">
                <div className="live-dot" /> Featured Collection
              </div>
              <div className="font-black text-[19px] text-white mb-1.5">
                {featured.title}
              </div>
              {featured.description && (
                <p className="text-[13px] text-white/55 leading-normal mb-3">
                  {featured.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-white/50">
                  {featured.listings.length} items
                </span>
                <span className="btn-sm-mg">Shop Collection &rarr;</span>
              </div>
              {featured.coverImageUrl && (
                <div className="absolute inset-0 -z-10 opacity-20 rounded-[16px] overflow-hidden">
                  <Image
                    src={featured.coverImageUrl}
                    alt={featured.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </Link>

            {/* Upcoming collections */}
            {upcoming.map((col) => (
              <Link key={col.id} href={`/explore`} className="drop-card">
                <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[var(--l-muted-lt)] mb-2">
                  Staff Pick
                </div>
                <div className="font-black text-[17px] text-[var(--l-black)] mb-1">{col.title}</div>
                {col.description && (
                  <p className="text-[13px] text-[var(--l-muted)] leading-normal mb-3">
                    {col.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[var(--l-muted)]">
                    {col.listings.length} items
                  </span>
                  <span className="btn-sm-gh">Browse &rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Right: Copy */}
          <div>
            <div className="section-label">Drops</div>
            <div className="section-title">Shopping as<br />an <em className="italic text-[var(--mg)]">event</em></div>
            <p className="text-[16px] text-[var(--l-muted)] leading-relaxed mb-6 max-w-[520px]">
              Twicely Drops turn category shopping into real-time events. Sellers queue their best inventory. Buyers arrive, bundle, and score. It&apos;s not browsing &mdash; it&apos;s an experience.
            </p>
            <div className="flex flex-col gap-3.5 mb-6">
              <div>
                <strong className="text-[14px] font-extrabold text-[var(--l-black)] block mb-0.5">Auto bundle discounts</strong>
                <span className="text-[13px] text-[var(--l-muted)] leading-normal">Buy 2+ items from any seller and unlock stacked savings automatically.</span>
              </div>
              <div>
                <strong className="text-[14px] font-extrabold text-[var(--l-black)] block mb-0.5">Drop reminders</strong>
                <span className="text-[13px] text-[var(--l-muted)] leading-normal">Set alerts for upcoming events and get first access before the crowd.</span>
              </div>
              <div>
                <strong className="text-[14px] font-extrabold text-[var(--l-black)] block mb-0.5">Curator economy</strong>
                <span className="text-[13px] text-[var(--l-muted)] leading-normal">Expert curators earn on their picks. Better curation, better drops.</span>
              </div>
            </div>
            <Link href="/explore" className="btn-mg mt-2">See all drops &rarr;</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
