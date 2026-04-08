import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import type { ListingCardData } from '@/types/listings';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCondition(condition: string): string {
  return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  listings: ListingCardData[];
}

export function LandingHero({ listings }: Props) {
  const heroCards = listings.slice(0, 4);

  return (
    <section className="bg-white border-b border-[var(--l-border)] py-14">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="hero-shell">
          <div className="hero-grid">
            {/* Left copy */}
            <div className="hero-copy animate-landing-fadeUp">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                The marketplace built for resale done right
              </div>
              <h1 className="hero-h1">
                Great stuff<br />sold <span className="text-[var(--mg)]">faster.</span>
              </h1>
              <p className="text-[17px] text-[var(--l-muted)] leading-relaxed mb-7 max-w-[46ch]">
                Twicely is a premium resale marketplace for buyers who care about quality and sellers who want real results. Clean listings, verified sellers, real prices.
              </p>
              <div className="flex gap-2.5 flex-wrap mb-8">
                <Link href="/s" className="btn-mg">Shop now</Link>
                <Link href="/become-seller" className="btn-blk">Start selling</Link>
                <Link href="/my/selling/crosslist/import" className="btn-ghost">Import listings</Link>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--l-muted)]">
                  <Check className="size-3.5 text-[#15803D] stroke-[3]" /> Fair resolution on every order
                </div>
                <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--l-muted)]">
                  <Check className="size-3.5 text-[#15803D] stroke-[3]" /> Verified sellers with trust scores
                </div>
                <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--l-muted)]">
                  <Check className="size-3.5 text-[#15803D] stroke-[3]" /> Authentication for luxury items
                </div>
              </div>
            </div>

            {/* Right visual — random sold items */}
            <div className="hero-visual animate-landing-fadeUp-delay">
              {heroCards.map((item) => (
                <Link key={item.id} href={`/i/${item.slug}`} className="product-card hero-pc">
                  <div className="media">
                    {item.primaryImageUrl ? (
                      <Image
                        src={item.primaryImageUrl}
                        alt={item.primaryImageAlt || item.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 220px"
                      />
                    ) : (
                      <div className="w-full h-full bg-[var(--l-bg)]" />
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      <span className="badge badge-red">Sold</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="meta-top">
                      <span>{item.brand || 'No brand'}</span>
                      <span>@{item.sellerUsername}</span>
                    </div>
                    <div className="prod-title">{item.title}</div>
                    <div className="prod-price">
                      {formatPrice(item.priceCents)}
                    </div>
                    <div className="prod-sub">{formatCondition(item.condition)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
