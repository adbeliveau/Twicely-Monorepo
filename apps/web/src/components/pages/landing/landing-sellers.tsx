import Link from 'next/link';
import Image from 'next/image';
import type { RisingSellerData } from '@/lib/queries/explore';

function formatBand(band: string): string {
  return band.charAt(0).toUpperCase() + band.slice(1).toLowerCase();
}

interface Props {
  sellers: RisingSellerData[];
}

export function LandingSellers({ sellers }: Props) {
  if (sellers.length === 0) return null;

  return (
    <section className="py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="flex items-end justify-between mb-7 gap-4">
          <div>
            <div className="section-label">Community</div>
            <div className="section-title">Sellers who get results</div>
          </div>
          <Link href="/explore" className="btn-ghost">See seller community &rarr;</Link>
        </div>
        <div className="seller-showcase grid grid-cols-3 gap-5">
          {sellers.map((seller) => {
            const storeHref = seller.storeSlug ? `/st/${seller.storeSlug}` : `/explore`;
            const displayName = seller.storeName || 'Seller';
            const initials = displayName.slice(0, 2).toUpperCase();

            return (
              <Link key={seller.userId} href={storeHref} className="seller-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="seller-avatar overflow-hidden">
                    {seller.avatarUrl ? (
                      <Image
                        src={seller.avatarUrl}
                        alt={displayName}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-[16px] font-black">{initials}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-black text-[15px] text-[var(--l-black)]">{displayName}</div>
                    <div className="text-[10.5px] font-bold text-[var(--mg)] mt-0.5">
                      {formatBand(seller.performanceBand)} seller
                    </div>
                  </div>
                </div>
                <div className="seller-stats">
                  <div className="ss">
                    <strong className="block text-[15px] font-black text-[var(--l-black)]">{seller.listingCount}</strong>
                    <span className="text-[10px] text-[var(--l-muted-lt)] font-semibold">Listings</span>
                  </div>
                  <div className="ss">
                    <strong className="block text-[15px] font-black text-[var(--l-black)]">{seller.followerCount}</strong>
                    <span className="text-[10px] text-[var(--l-muted-lt)] font-semibold">Followers</span>
                  </div>
                  <div className="ss">
                    <strong className="block text-[15px] font-black text-[var(--l-black)]">
                      {new Date(seller.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </strong>
                    <span className="text-[10px] text-[var(--l-muted-lt)] font-semibold">Joined</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
