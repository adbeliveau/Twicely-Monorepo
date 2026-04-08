import Link from 'next/link';
import Image from 'next/image';
import type { ListingCardData } from '@/types/listings';
import { LandingHeartButton } from './landing-heart-button';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function discount(original: number | null, current: number): number | null {
  if (!original || original <= current) return null;
  return Math.round(((original - current) / original) * 100);
}

function formatCondition(condition: string): string {
  return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  listings: ListingCardData[];
}

export function LandingTrending({ listings }: Props) {
  if (listings.length === 0) return null;

  return (
    <section className="py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="flex items-end justify-between mb-7 gap-4">
          <div>
            <div className="section-label">Trending Now</div>
            <div className="section-title">Just listed &middot; Most watched</div>
          </div>
          <div className="flex gap-2">
            <Link href="/s?sort=trending" className="btn-ghost text-[13px] !py-2 !px-4.5">See all &rarr;</Link>
          </div>
        </div>
        <div className="prod-grid-5">
          {listings.map((listing) => {
            const off = discount(listing.originalPriceCents, listing.priceCents);
            return (
              <Link key={listing.id} href={`/i/${listing.slug}`} className="product-card">
                <div className="media">
                  {listing.primaryImageUrl ? (
                    <Image
                      src={listing.primaryImageUrl}
                      alt={listing.primaryImageAlt || listing.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 250px"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--l-bg)]" />
                  )}
                  <div className="prod-actions">
                    <LandingHeartButton
                      listingId={listing.id}
                      listingSlug={listing.slug}
                    />
                  </div>
                  {listing.freeShipping && (
                    <div className="absolute top-2.5 left-2.5"><span className="badge badge-green">Free ship</span></div>
                  )}
                </div>
                <div className="card-body">
                  <div className="meta-top">
                    <span>{listing.brand || 'No brand'}</span>
                    <span>@{listing.sellerUsername}</span>
                  </div>
                  <div className="prod-title">{listing.title}</div>
                  <div className="prod-price">
                    {formatPrice(listing.priceCents)}
                    {listing.originalPriceCents && listing.originalPriceCents > listing.priceCents && (
                      <>
                        {' '}<span className="prod-og">{formatPrice(listing.originalPriceCents)}</span>
                        {off && <> <span className="prod-off">&minus;{off}%</span></>}
                      </>
                    )}
                  </div>
                  <div className="prod-sub">{formatCondition(listing.condition)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
